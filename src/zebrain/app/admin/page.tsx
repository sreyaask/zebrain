"use client";

import { useCallback, useEffect, useState } from "react";

type U = { email: string; models: number; credits_bought: number; credits_spent: number; refunds: number; balance: number; tokens: number; requests: number; qwen_usd: number };
type Data = {
  services: Record<string, boolean>;
  totals: { users: number; activeUsers: number; models: number; revenue: Record<string, { revenue: number; gst: number }>; qwenUsd: number; outstandingCredits: number; failedRuns: number };
  users: U[];
  alerts: { id: number; kind: string; message: string; created_at: string }[];
  limits: { key: string; value: number; note: string | null }[];
  discrepancies: { user_id: string; balance: number; ledger_sum: number }[];
  audit: { id: number; actor: string; action: string; target: string | null; meta: object; created_at: string }[];
  versions: { pricing: string; registry: string };
  notes: string[];
  status: { service: string; up: boolean; reason: string | null; since: string; checked_at: string | null }[];
  waitlist: { email: string; created_at: string; notified_at: string | null; notify_error: string | null }[];
};
type Check = { name: string; status: string; detail: string; ms?: number };

export default function AdminPage() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const load = useCallback(() => {
    fetch("/api/admin").then(async (r) => {
      const j = await r.json();
      if (!r.ok) setErr(j.error || "Couldn't load.");
      else setD(j);
    }).catch(() => setErr("Couldn't reach the server."));
  }, []);
  useEffect(load, [load]);
  async function act(body: { action: string; [k: string]: unknown }) {
    setBusy(body.action);
    setNote("");
    const r = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setBusy("");
    if (!r.ok) setErr(j.error || "That didn't work.");
    if (j.checks) setChecks(j.checks);
    if (j.probe) setNote(j.probe.ok ? "Qwen answered: service marked back up." : `Still down: ${j.probe.detail}`);
    if (j.emails) setNote((n) => `${n} Emails: ${j.emails.sent} of ${j.emails.waiting} sent${j.emails.errors?.length ? ` (${j.emails.errors.join("; ")})` : ""}.`.trim());
    load();
  }

  if (err && !d) return <Shell><p role="alert" className="text-bad">{err}</p></Shell>;
  if (!d) return <Shell><p className="text-mute">Loading…</p></Shell>;
  const t = d.totals;
  const stats: [string, string][] = [
    ["Users", `${t.users} (${t.activeUsers} have run a job)`],
    ["Models trained", String(t.models)],
    ["Failed runs", String(t.failedRuns)],
    ["Revenue (excl. GST)", Object.entries(t.revenue).map(([c, v]) => `${v.revenue.toFixed(2)} ${c}`).join(" + ") || "0"],
    ["GST collected", Object.entries(t.revenue).filter(([, v]) => v.gst).map(([c, v]) => `${v.gst.toFixed(2)} ${c}`).join(" + ") || "0"],
    ["Qwen spend (estimated)", `$${t.qwenUsd.toFixed(2)}`],
    ["Credits owed to users", `${t.outstandingCredits.toLocaleString()} ($${(t.outstandingCredits / 100).toFixed(2)})`],
  ];
  return (
    <Shell>
      {err && <p role="alert" className="mb-4 text-sm text-bad">{err}</p>}
      <dl className="mb-10 grid gap-x-8 gap-y-4 border-t border-line pt-6 sm:grid-cols-3">
        {stats.map(([k, v]) => <div key={k}><dt className="text-sm text-mute">{k}</dt><dd className="text-xl tabular-nums">{v}</dd></div>)}
      </dl>

      <Section title="Does it work?">
        <div className="mb-3 flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={!!busy} onClick={() => act({ action: "run_checks", live: false })}>Check keys</button>
          <button className="btn" disabled={!!busy} onClick={() => act({ action: "run_checks", live: true })}>{busy === "run_checks" ? "Checking…" : "Run live checks"}</button>
        </div>
        <p className="mb-3 text-xs text-mute">Live checks make one tiny call per service (Qwen: a 5-token reply) and email you a test message. Nothing is bought or created.</p>
        {checks && (
          <ul className="divide-y divide-line border-y border-line text-sm">
            {checks.map((c) => (
              <li key={c.name} className="grid gap-1 py-2.5 sm:grid-cols-[90px_220px_1fr]">
                <span className={c.status === "PASS" ? "text-accent" : c.status === "FAIL" ? "text-bad" : "text-mute"}>{c.status}</span>
                <span>{c.name}</span>
                <span className="text-mute">{c.detail}{c.ms ? ` · ${c.ms} ms` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Service status">
        {d.status.map((st) => (
          <p key={st.service} className="mb-2 text-sm">
            <span className={st.up ? "text-accent" : "text-bad"}>{st.service}: {st.up ? "in service" : "OUT OF SERVICE"}</span>
            <span className="text-mute"> since {new Date(st.since).toLocaleString()}{st.reason ? ` · ${st.reason}` : ""}{st.checked_at ? ` · last checked ${new Date(st.checked_at).toLocaleString()}` : ""}</span>
          </p>
        ))}
        <div className="my-3 flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={!!busy} onClick={() => act({ action: "simulate_outage" })}>Simulate an outage</button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => act({ action: "probe" })}>{busy === "probe" ? "Checking Qwen…" : "Check if Qwen is back"}</button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => act({ action: "mark_up" })}>Mark back in service and email waitlist</button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => act({ action: "retry_emails" })}>Retry unsent emails</button>
        </div>
        {note && <p role="status" className="mb-3 text-sm">{note}</p>}
        <p className="mb-2 text-sm text-mute">
          Waitlist: {d.waitlist.filter((w) => !w.notified_at).length} waiting, {d.waitlist.filter((w) => w.notified_at).length} emailed.
        </p>
        {d.waitlist.length > 0 && (
          <ul className="max-h-60 overflow-y-auto border-y border-line text-sm">
            {d.waitlist.map((w) => (
              <li key={w.email + w.created_at} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-b-0">
                <span>{w.email}</span>
                <span className="text-mute">{w.notified_at ? `emailed ${new Date(w.notified_at).toLocaleString()}` : w.notify_error ? `not sent: ${w.notify_error}` : `waiting since ${new Date(w.created_at).toLocaleString()}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Services">
        <p className="text-sm">{Object.entries(d.services).map(([k, on]) => `${k}: ${on ? "on" : "off (keys missing)"}`).join(" · ")}</p>
        <p className="mt-1 text-xs text-mute">Pricing {d.versions.pricing} · model registry {d.versions.registry}. {d.notes.join(" ")}</p>
      </Section>

      <Section title={`Alerts (${d.alerts.length})`}>
        {d.alerts.length === 0 ? <p className="text-sm text-mute">No open alerts.</p> : (
          <ul className="divide-y divide-line border-y border-line text-sm">
            {d.alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                <span>{a.message} <span className="text-mute">· {new Date(a.created_at).toLocaleString()}</span></span>
                <button className="link text-mute" onClick={() => act({ action: "resolve_alert", id: a.id })}>Mark resolved</button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Spending limits">
        <ul className="divide-y divide-line border-y border-line text-sm">
          {d.limits.map((l) => <LimitRow key={l.key} limit={l} onSave={(v) => act({ action: "set_limit", key: l.key, value: v })} />)}
        </ul>
      </Section>

      <Section title={`Billing discrepancies (${d.discrepancies.length})`}>
        {d.discrepancies.length === 0 ? <p className="text-sm text-mute">Every wallet balance matches its ledger.</p> : (
          <ul className="text-sm">{d.discrepancies.map((x) => <li key={x.user_id}>{x.user_id}: balance {x.balance}, ledger {x.ledger_sum}</li>)}</ul>
        )}
      </Section>

      <Section title="Users">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead><tr className="text-left text-[13px] text-mute">
              {["User", "Models", "Credits bought", "Spent", "Refunded", "Balance", "Qwen tokens", "Requests", "Qwen cost"].map((h) => <th key={h} className="border-b border-line py-2 pr-4 font-normal">{h}</th>)}
            </tr></thead>
            <tbody>
              {d.users.map((u) => (
                <tr key={u.email} className="tabular-nums">
                  <td className="border-b border-line py-2 pr-4">{u.email}</td>
                  <td className="border-b border-line py-2 pr-4">{u.models}</td>
                  <td className="border-b border-line py-2 pr-4">{u.credits_bought.toLocaleString()}</td>
                  <td className="border-b border-line py-2 pr-4">{u.credits_spent.toLocaleString()}</td>
                  <td className="border-b border-line py-2 pr-4">{u.refunds.toLocaleString()}</td>
                  <td className="border-b border-line py-2 pr-4">{u.balance.toLocaleString()}</td>
                  <td className="border-b border-line py-2 pr-4">{(u.tokens / 1e6).toFixed(2)}M</td>
                  <td className="border-b border-line py-2 pr-4">{u.requests}</td>
                  <td className="border-b border-line py-2 pr-4">${u.qwen_usd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Audit log">
        <ul className="space-y-1 text-sm text-mute">
          {d.audit.map((a) => <li key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.actor} · {a.action} {a.target ?? ""} {JSON.stringify(a.meta)}</li>)}
          {d.audit.length === 0 && <li>No admin actions yet.</li>}
        </ul>
      </Section>
    </Shell>
  );
}

function LimitRow({ limit, onSave }: { limit: { key: string; value: number; note: string | null }; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(limit.value));
  return (
    <li className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_140px_auto]">
      <span>{limit.key}<span className="block text-xs text-mute">{limit.note}</span></span>
      <label className="sr-only" htmlFor={limit.key}>{limit.key}</label>
      <input id={limit.key} className="input tabular-nums" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-ghost" disabled={v === String(limit.value) || !Number.isFinite(Number(v))} onClick={() => onSave(Number(v))}>Save</button>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-10"><h2 className="mb-3 text-xl font-medium">{title}</h2>{children}</section>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <header className="pb-8 pt-14 md:pt-20"><h1 className="text-4xl font-medium tracking-tight md:text-5xl">Admin</h1></header>
      {children}
    </main>
  );
}
