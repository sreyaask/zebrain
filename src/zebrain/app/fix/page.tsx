"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Correction, PendingCorrection, Version } from "@/lib/job";
import { Account, loadAccount, loadRuns, runHref, startRun } from "@/lib/local";

type Identity = { name: string; maker: string; founder: string };
type ModelInfo = {
  versions: Version[];
  config: { base_model: string; model_name: string; purpose?: string; identity?: Identity };
  model: string;
  corrections: PendingCorrection[];
};

const EMPTY: Correction = { question: "", got: "", answer: "" };
const SPECIAL = /<\|[a-z_]+\|>|<\/?s>/g;
const clean = (t: string) => t.replace(SPECIAL, "").trim();
// A "question" that reads like the model's own reply is the most common mix-up.
const looksLikeReply = (q: string) => /^(i'?m|i am|hello! i|sure[,!])/i.test(q.trim()) || /<\|[a-z_]+\|>/.test(q);

export default function FixPage() {
  return (
    <Suspense>
      <Fix />
    </Suspense>
  );
}

function Fix() {
  const router = useRouter();
  const params = useSearchParams();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [known, setKnown] = useState<string[]>([]);
  const [repo, setRepo] = useState(params.get("m") ?? "");
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [rows, setRows] = useState<Correction[]>([{ ...EMPTY }]);
  const [fromChat, setFromChat] = useState(0);
  const [identity, setIdentity] = useState<Identity>({ name: "", maker: "", founder: "" });
  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [tBusy, setTBusy] = useState(false);
  const [tErr, setTErr] = useState("");
  const [tRounds, setTRounds] = useState(3);
  const [err, setErr] = useState("");


  useEffect(() => {
    loadAccount().then(setAccount);
    loadRuns().then((rs) => setKnown([...new Set(rs.filter((r) => r.mode === "train").map((r) => r.stateRepo))]));
  }, []);
  useEffect(() => {
    if (!repo && known.length) setRepo(known[0]);
  }, [known, repo]);

  useEffect(() => {
    if (!account?.connected || !/^[\w.-]+\/[\w.-]+-zebrain$/.test(repo)) return;
    setInfo(null);
    setLoadErr("");
    fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stateRepo: repo }) })
      .then((r) => r.json())
      .then((d: ModelInfo & { error?: string }) => {
        if (d.error) return setLoadErr(d.error);
        setInfo(d);
        setFromVersion(d.versions.length ? d.versions[d.versions.length - 1].version : null);
        setIdentity({ name: "", maker: "", founder: "", ...d.config.identity });
        if (d.corrections.length) {
          setRows(d.corrections.map((c) => ({ question: c.question, got: c.got ?? "", answer: c.answer })));
          setFromChat(d.corrections.length);
        }
      })
      .catch(() => setLoadErr("Couldn't reach Zebrain's server."));
  }, [account, repo]);

  const ready = rows.filter((r) => clean(r.question) && clean(r.answer));
  const old = info?.config.identity;
  const identityChanged = !!old && identity.name.trim() !== "" &&
    (identity.name.trim() !== old.name || identity.maker.trim() !== (old.maker ?? "") || identity.founder.trim() !== (old.founder ?? ""));
  const setRow = (i: number, k: keyof Correction) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));

  async function start() {
    if (!account?.connected || !info) return;
    setBusy(true);
    setErr("");
    try {
      const run = await startRun({
        mode: "fix",
        base_model: info.config.base_model,
        model_name: info.config.model_name,
        from_version: fromVersion ?? undefined,
        corrections: ready.map((r) => ({ question: clean(r.question), got: clean(r.got ?? "") || undefined, answer: clean(r.answer) })),
        identity: identityChanged ? { name: identity.name.trim(), maker: identity.maker.trim(), founder: identity.founder.trim() } : undefined,
        chat_hours: 1,
      });
      router.push(runHref(run));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't start the fix.");
      setBusy(false);
    }
  }

  async function testify() {
    if (!account?.connected || !info) return;
    setTBusy(true);
    setTErr("");
    try {
      const run = await startRun({
        mode: "improve",
        base_model: info.config.base_model,
        model_name: info.config.model_name,
        from_version: fromVersion ?? undefined,
        rounds: tRounds,
        chat_hours: 1,
      });
      router.push(runHref(run));
    } catch (e) {
      setTErr(e instanceof Error ? e.message : "Couldn't start.");
      setTBusy(false);
    }
  }

  if (account === undefined) return <Shell>{null}</Shell>;
  if (!account?.connected) {
    return (
      <Shell>
        <p className="text-mute">
          <Link className="link text-paper" href="/connect?next=/fix">Connect Kaggle and Hugging Face</Link> to fix a model.
        </p>
      </Shell>
    );
  }

  const n = ready.length;
  return (
    <Shell>
      <div className="mb-10 max-w-xl">
        <label className="label" htmlFor="repo">Model</label>
        {known.length > 0 ? (
          <select id="repo" className="input font-mono" value={repo} onChange={(e) => setRepo(e.target.value)}>
            {!known.includes(repo) && repo && <option value={repo}>{repo.replace(/-zebrain$/, "")}</option>}
            {known.map((k) => <option key={k} value={k}>{k.replace(/-zebrain$/, "")}</option>)}
          </select>
        ) : (
          <input id="repo" className="input font-mono" value={repo} onChange={(e) => setRepo(e.target.value.trim())} placeholder="username/model-name-zebrain" />
        )}
        {loadErr && <p role="alert" className="mt-2 text-sm text-bad">{loadErr}</p>}
      </div>

      {info && (
        <section id="testify" aria-labelledby="testify-h" className="mb-2 scroll-mt-20 rounded-2xl border border-accent/40 bg-accent/5 p-5">
          <h2 id="testify-h" className="mb-1 text-lg font-medium"><span className="pixel">Testify</span></h2>
          <p className="mb-4 max-w-[68ch] text-sm text-paper/80">
            Zebrain AI grades {fromVersion ? `v${fromVersion}` : "the current version"} on its test questions, works out which topics it
            gets wrong, writes new practice examples for exactly those topics and trains it again, keeping its name and
            manners. It never trains on the test questions themselves, and it publishes a new version only if it got better.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label" htmlFor="tr">Rounds, at most</label>
              <select id="tr" className="input w-28" value={tRounds} onChange={(e) => setTRounds(+e.target.value)}>
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button className="btn" onClick={testify} disabled={tBusy || !info.versions.length}>
              {tBusy ? "Sending to Kaggle…" : "Testify this model"}
            </button>
          </div>
          <p className="mt-3 text-xs text-mute">Runs on your Kaggle GPU, about 30–60 minutes per round. Free while in early access.</p>
          {tErr && <p role="alert" className="mt-3 text-sm text-bad">{tErr}</p>}
        </section>
      )}

      {info && (
        <>
          <section aria-labelledby="corr" className="border-t border-line py-8">
            <h2 id="corr" className="mb-1 text-lg font-semibold">What it got wrong</h2>
            <p className="mb-2 max-w-[64ch] text-sm text-mute">
              Put what a person typed in the first box, and the reply you want in the last. Zebrain turns each one into
              around 20 training examples (reworded by Zebrain AI), mixes in earlier data so it
              doesn&apos;t forget, and continues training the current version.
            </p>
            {fromChat > 0 && <p className="mb-6 text-sm">{fromChat} correction{fromChat > 1 ? "s" : ""} saved from the chat, filled in below.</p>}
            <ol className="mt-6 space-y-8">
              {rows.map((r, i) => (
                <li key={i} className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Area id={`q${i}`} label={`${i + 1}. What the person asked`} value={r.question} onChange={setRow(i, "question")} placeholder="who are you?" />
                    {looksLikeReply(r.question) && (
                      <p className="mt-1.5 text-xs text-bad">This looks like the model&apos;s reply. Put the reply in the middle box, and here what the person asked.</p>
                    )}
                  </div>
                  <Area id={`g${i}`} label="What the model replied (optional)" value={r.got ?? ""} onChange={setRow(i, "got")} placeholder="I'm an AI assistant made by OpenAI." />
                  <Area id={`a${i}`} label="What it should reply" value={r.answer} onChange={setRow(i, "answer")} placeholder="I'm sql-assistant, built by Zebrain Labs. I turn questions into SQL." />
                  {rows.length > 1 && (
                    <button type="button" className="link justify-self-start text-sm text-mute md:col-span-3" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      Remove this one
                    </button>
                  )}
                </li>
              ))}
            </ol>
            <button type="button" className="btn-ghost mt-6" onClick={() => setRows([...rows, { ...EMPTY }])}>Add another</button>
          </section>

          <section aria-labelledby="who" className="border-t border-line py-8">
            <h2 id="who" className="mb-1 text-lg font-semibold">Name and maker</h2>
            <p className="mb-5 max-w-[64ch] text-sm text-mute">
              Change these and the fix run retrains how it introduces itself, and builds the new name into the model so it
              holds even when an app sends no instructions.
            </p>
            <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
              <Input id="idn" label="Model name" value={identity.name} onChange={(v) => setIdentity({ ...identity, name: v })} />
              <Input id="idm" label="Built by" value={identity.maker} onChange={(v) => setIdentity({ ...identity, maker: v })} placeholder="Zebrain Labs" />
              <Input id="idf" label="Founder (optional)" value={identity.founder} onChange={(v) => setIdentity({ ...identity, founder: v })} />
            </div>
          </section>

          <section className="border-t border-line py-8">
            <div className="mb-6 max-w-xs">
              <label className="label" htmlFor="from">Start from</label>
              <select id="from" className="input" value={fromVersion ?? ""} onChange={(e) => setFromVersion(+e.target.value)}>
                {info.versions.map((v) => <option key={v.version} value={v.version}>{v.tag}</option>)}
              </select>
            </div>
            {err && <p role="alert" className="mb-4 max-w-[64ch] text-sm text-bad">{err}</p>}
            <button className="btn" onClick={start} disabled={busy || (!n && !identityChanged) || !info.versions.length}>
              {busy ? "Starting…" : n ? `Fix ${n} answer${n === 1 ? "" : "s"} on Kaggle` : "Update the name on Kaggle"}
            </button>
            <p className="mt-3 max-w-[64ch] text-sm text-mute">
              It publishes a new version only if the tester passes, then opens a chat with it for an hour.
            </p>
          </section>

          <section aria-labelledby="ver" className="border-t border-line py-8">
            <h2 id="ver" className="mb-1 text-lg font-semibold">Versions</h2>
            <p className="mb-5 max-w-[64ch] text-sm text-mute">Every run publishes a new version and keeps the old ones, so you can chat with any of them.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[13px] text-mute">
                    {["Version", "Made", "Test questions", "What changed", ""].map((h, i) => <th key={i} className="border-b border-line py-2 pr-4 font-normal">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...info.versions].reverse().map((v) => (
                    <tr key={v.version}>
                      <td className="border-b border-line py-3 pr-4 font-mono">{v.tag}</td>
                      <td className="whitespace-nowrap border-b border-line py-3 pr-4 text-mute">{new Date(v.created_at * 1000).toLocaleDateString()}</td>
                      <td className="border-b border-line py-3 pr-4 font-mono tabular-nums">{v.scores.task != null ? `${Math.round(v.scores.task * 100)}%` : "–"}</td>
                      <td className="border-b border-line py-3 pr-4 text-mute">{v.notes}</td>
                      <td className="border-b border-line py-3 pr-4">
                        <Link className="link whitespace-nowrap" href={`/chat?m=${encodeURIComponent(repo)}&v=${v.tag}`}>Chat</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <header className="pb-8 pt-14 md:pt-20">
        <h1 className="mb-3 text-4xl font-medium tracking-tight md:text-5xl">Fix wrong answers</h1>
        <p className="max-w-[60ch] text-lg text-mute">
          No need to train from the start. Zebrain continues from the version you have and tests the fix before publishing it.
        </p>
      </header>
      {children}
    </main>
  );
}

function Area(props: { id: string; label: string; value: string; placeholder: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void }) {
  return (
    <div>
      <label className="label" htmlFor={props.id}>{props.label}</label>
      <textarea id={props.id} rows={4} className="input font-mono text-[13px]" value={props.value} onChange={props.onChange} placeholder={props.placeholder} />
    </div>
  );
}

function Input(props: { id: string; label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor={props.id}>{props.label}</label>
      <input id={props.id} className="input" value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder} />
    </div>
  );
}
