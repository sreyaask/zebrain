"use client";

import { useEffect, useState } from "react";
import { PLANS, type Plan, type Quote } from "@/lib/quote";
import { supabase } from "@/lib/supabase/client";

export type PlanStatus = {
  trialAvailable: boolean;
  services: { payments: boolean; qwen: boolean; runpod: boolean; trials: boolean };
  paidOrders: { id: string; plan: string; model_name: string; base_model: string }[];
  qwenUp: boolean;
};

export function usePlanStatus() {
  const [status, setStatus] = useState<PlanStatus | null>(null);
  useEffect(() => {
    fetch("/api/plans").then((r) => r.json()).then((d) => !d.error && setStatus(d)).catch(() => {});
  }, []);
  return status;
}

// The first choice when making a model. The three options differ in who pays for the GPU and who writes the data,
// so each row says exactly that, with the price on the right.
export function PlanStep({ plan, setPlan, status }: { plan: Plan; setPlan: (p: Plan) => void; status: PlanStatus | null }) {
  const trialOpen = status?.trialAvailable && status.services.trials && status.services.qwen;
  const proOpen = status?.services.qwen && status.services.runpod;
  const rows: { id: Plan; title: string; price: string; points: string[]; off?: string }[] = [
    {
      id: "trial", title: "Free trial", price: "Free, once",
      points: ["Zebrain AI writes your dataset from your documents or the web", "Tested before it's published", "Trains on your Kaggle GPU, models up to 9B", "No card needed"],
      off: !status ? undefined : !status.trialAvailable ? "You've used your free trial." : !trialOpen ? "Opens soon." : !status.qwenUp ? "Paused: we're out of service right now." : undefined,
    },
    {
      id: "basic", title: "Basic", price: "Free",
      points: ["AI picks existing datasets for your job", "Trains once and publishes, no testing round", "Your Kaggle GPU (about 30 free hours a week), models up to 9B"],
    },
    {
      id: "standard", title: "Pro", price: "Priced per model",
      points: ["Zebrain AI writes a dataset just for your job from your documents", "Trains on Zebrain's GPUs at full precision, tested and retrained", "Pick Standard or Extreme (up to 14B); paid from your credits"],
      off: status && !proOpen ? "Opens soon. Basic and the free trial work now." : status && !status.qwenUp ? "Paused: we're out of service right now. Basic still works." : undefined,
    },
  ];
  return (
    <div role="radiogroup" aria-label="Plan" className="border-t border-line">
      {rows.map((r) => {
        const on = plan === r.id || (r.id === "standard" && plan === "extreme");
        return (
          <button
            key={r.id}
            role="radio"
            aria-checked={on}
            disabled={!!r.off}
            onClick={() => setPlan(r.id)}
            className={`grid w-full gap-x-6 gap-y-2 border-b border-line py-5 text-left transition-colors sm:grid-cols-[1fr_auto] ${on ? "" : "hover:bg-panel/60"} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <div className="flex gap-4">
              <span aria-hidden className={`mt-1.5 h-4 w-4 shrink-0 rounded-full border-2 ${on ? "border-accent bg-accent shadow-[inset_0_0_0_3px_#000]" : "border-line"}`} />
              <div>
                <span className={`text-2xl font-medium tracking-tight ${on ? "text-paper" : ""}`}>{r.title}</span>
                <ul className="mt-2 space-y-1 text-sm text-mute">
                  {r.points.map((p) => <li key={p}>{p}</li>)}
                </ul>
                {r.off && <p className="mt-2 text-sm text-paper">{r.off}</p>}
              </div>
            </div>
            <span className="pl-8 text-lg tabular-nums sm:pl-0 sm:text-right">{r.price}</span>
          </button>
        );
      })}
    </div>
  );
}

// Uploads go straight from the browser to the user's private folder; Zebrain AI reads them during the run.
export function DocsUpload({ docs, setDocs }: { docs: { path: string; name: string; bytes: number }[]; setDocs: (d: { path: string; name: string; bytes: number }[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr("");
    const sb = supabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      setErr("Sign in to upload documents.");
      setBusy(false);
      return;
    }
    const added = [];
    for (const f of Array.from(files).slice(0, 20)) {
      if (f.size > 25 * 1024 * 1024) {
        setErr(`${f.name} is over 25 MB. Split it into smaller files.`);
        continue;
      }
      const path = `${user.id}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await sb.storage.from("documents").upload(path, f);
      if (error) setErr(`Couldn't upload ${f.name}: ${error.message}`);
      else added.push({ path, name: f.name, bytes: f.size });
    }
    setDocs([...docs, ...added]);
    setBusy(false);
  }
  return (
    <div className="mb-8">
      <label htmlFor="docs" className="label">Your documents (PDF, Word, text, Markdown, CSV, JSON, HTML)</label>
      <div className="rounded-lg border border-dashed border-line p-5">
        <input id="docs" type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm" disabled={busy}
          onChange={(e) => { add(e.target.files); e.target.value = ""; }}
          className="block w-full text-sm text-mute file:mr-4 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink" />
        <p className="mt-3 text-sm text-mute">
          {busy ? "Uploading…" : "Zebrain AI reads them, finds the topics, and writes questions and answers from them. No documents? It researches your job on the web instead."}
        </p>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}
      {docs.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
          {docs.map((d) => (
            <li key={d.path} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 break-all">{d.name} <span className="text-mute">· {(d.bytes / 1024).toFixed(0)} KB</span></span>
              <button className="link text-mute" onClick={() => setDocs(docs.filter((x) => x.path !== d.path))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Standard vs Extreme, priced from this exact model and job, side by side.
export function ProOptions({ quotes, plan, setPlan }: {
  quotes: { standard: Quote | { error: string }; extreme: Quote | { error: string } } | null;
  plan: Plan; setPlan: (p: Plan) => void;
}) {
  if (!quotes) return <p className="text-sm text-mute">Working out the price…</p>;
  const notes = [...new Set([quotes.standard, quotes.extreme].flatMap((q) => ("warnings" in q ? q.warnings : [])))];
  const opts = [
    { id: "standard" as const, title: "Standard", line: "Good results at a lower price. Smaller, token-capped dataset." },
    { id: "extreme" as const, title: "Extreme", line: "Best results. About four times the data and a stricter judge." },
  ];
  return (
    <div role="radiogroup" aria-label="Pro option" className="grid gap-3 sm:grid-cols-2">
      {opts.map((o) => {
        const q = quotes[o.id];
        const bad = "error" in q;
        const on = plan === o.id;
        return (
          <button key={o.id} role="radio" aria-checked={on} disabled={bad} onClick={() => setPlan(o.id)}
            className={`rounded-xl border p-5 text-left transition-colors disabled:opacity-50 ${on ? "border-accent bg-accent/[0.06]" : "border-line hover:border-paper/50"}`}>
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-lg font-medium">{o.title}</span>
              <span className="text-2xl font-medium tabular-nums">{bad ? "–" : `$${q.price.toFixed(2)}`}</span>
            </span>
            <span className="mt-1 block text-sm text-mute">{o.line}</span>
            {bad ? (
              <span className="mt-3 block text-sm">{q.error}</span>
            ) : (
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-mute">Examples</dt><dd className="tabular-nums">{q.examples.toLocaleString()} written by Zebrain AI</dd>
                <dt className="text-mute">GPU</dt><dd>{q.gpu.count > 1 ? `${q.gpu.count} × ` : ""}{q.gpu.name}, about {Math.max(1, Math.round(q.gpu.hours * 60))} min</dd>
                <dt className="text-mute">AI tokens</dt><dd className="tabular-nums">{((q.qwen.inputTokens + q.qwen.outputTokens) / 1e6).toFixed(1)}M</dd>
                {q.languages > 1 && <><dt className="text-mute">Languages</dt><dd>{q.languages}, data split across them</dd></>}
              </dl>
            )}
          </button>
        );
      })}
      {notes.length > 0 && (
        <ul className="space-y-1 text-sm sm:col-span-2" aria-label="Before you pay">
          {notes.map((n) => <li key={n} className="border-l-2 border-accent pl-3">{n}</li>)}
        </ul>
      )}
    </div>
  );
}

type RazorpayHandlerResult = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
  }
}

function loadCheckout() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Razorpay. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

// Buy a credit pack: the server prices it, Razorpay collects, the server checks the signature and adds credits.
export async function buyCredits(packageId: string, country: "IN" | "INTL") {
  const res = await fetch("/api/credits/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ package_id: packageId, country }) });
  const order = await res.json();
  if (!res.ok) throw new Error(order.error || "Couldn't start the payment.");
  await loadCheckout();
  const result = await new Promise<RazorpayHandlerResult>((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: order.keyId, order_id: order.razorpayOrderId, amount: order.amount, currency: order.currency,
      name: "Zebrain", description: `${order.credits.toLocaleString()} credits`, prefill: { email: order.email }, theme: { color: "#3d7bff" },
      handler: resolve,
      modal: { ondismiss: () => reject(new Error("Payment cancelled. You haven't been charged.")) },
    });
    rz.on("payment.failed", (r) => reject(new Error(r.error?.description || "The payment failed. You haven't been charged.")));
    rz.open();
  });
  const v = await fetch("/api/checkout/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: order.orderId, razorpay_payment_id: result.razorpay_payment_id, razorpay_signature: result.razorpay_signature }),
  });
  const ok = await v.json();
  if (!v.ok) throw new Error(ok.error || "Couldn't confirm the payment.");
}

export { PLANS };
