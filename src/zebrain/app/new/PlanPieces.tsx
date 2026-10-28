"use client";

import { useCallback, useEffect, useState } from "react";
import { PLANS, type Plan, type Quote } from "@/lib/quote";
import { supabase } from "@/lib/supabase/client";
import { play } from "@/lib/sound";
import { CardGroup, ErrorNote, Icon, Skeleton, type Choice } from "../ui";

export type PlanStatus = {
  trialAvailable: boolean;
  services: { payments: boolean; qwen: boolean; runpod: boolean; trials: boolean };
  paidOrders: { id: string; plan: string; model_name: string; base_model: string }[];
  qwenUp: boolean;
};

export function usePlanStatus() {
  const [status, setStatus] = useState<PlanStatus | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setStatus(d)))
      .catch(() => setError("Couldn't load the plans. Check your connection."));
  }, []);
  useEffect(load, [load]);
  return { status, error, retry: load };
}

// The first choice when making a model. The three options differ in who pays for the GPU and who writes the data,
// so each card says exactly that, with the price at the top.
export function PlanStep({ plan, setPlan, status }: { plan: Plan; setPlan: (p: Plan) => void; status: PlanStatus | null }) {
  const trialOpen = status?.trialAvailable && status.services.trials && status.services.qwen;
  const proOpen = status?.services.qwen && status.services.runpod;
  const rows: (Choice<Plan> & { points: string[] })[] = [
    {
      value: "trial", title: "Free trial", aside: "Free, once", icon: "gift",
      points: ["Zebrain AI writes your dataset from your documents or the web", "Tested before it's published", "Your Kaggle GPU, models up to 9B", "No card needed"],
      off: !status ? undefined : !status.trialAvailable ? "You've used your free trial." : !trialOpen ? "Opens soon." : !status.qwenUp ? "Paused: we're out of service right now." : undefined,
    },
    {
      value: "basic", title: "Basic", aside: "Free", icon: "cpu",
      points: ["AI picks existing datasets for your job", "Trains once and publishes, no testing round", "Your Kaggle GPU (about 30 free hours a week), models up to 9B"],
    },
    {
      value: "standard", title: "Pro", aside: "Priced per model", icon: "rocket",
      points: ["Zebrain AI writes a dataset just for your job from your documents", "Trains on Zebrain's GPUs at full precision, tested and retrained", "Pick Standard or Extreme (up to 14B); paid from your credits"],
      off: status && !proOpen ? "Opens soon. Basic and the free trial work now." : status && !status.qwenUp ? "Paused: we're out of service right now. Basic still works." : undefined,
    },
  ];
  const options = rows.map((r) => ({
    ...r,
    flag: r.value === "trial" && !r.off ? "Best for a first model" : undefined,
    desc: <ul className="space-y-1">{r.points.map((p) => <li key={p} className="flex gap-2"><Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />{p}</li>)}</ul>,
  }));
  return <CardGroup label="Plan" options={options} value={plan === "extreme" ? "standard" : plan} onChange={setPlan} cols="md:grid-cols-3" />;
}

// Uploads go straight from the browser to the user's private folder; Zebrain AI reads them during the run.
// Drop files anywhere on the box, or pick them.
export function DocsUpload({ docs, setDocs }: { docs: { path: string; name: string; bytes: number }[]; setDocs: (d: { path: string; name: string; bytes: number }[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
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
    if (added.length) play("step");
    setDocs([...docs, ...added]);
    setBusy(false);
  }
  return (
    <div className="mb-8">
      <label
        htmlFor="docs"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        className={`card cursor-pointer items-center border-dashed py-9 text-center focus-within:border-accent ${over ? "border-accent bg-accent/[0.08]" : ""}`}
      >
        <span className={`card-icon h-14 w-14 ${busy ? "animate-pulse" : ""}`}><Icon name="upload" className="h-6 w-6" /></span>
        <span className="text-[17px] font-medium">{busy ? "Uploading…" : over ? "Drop to upload" : "Drop your documents here, or click to choose"}</span>
        <span className="max-w-[52ch] text-sm text-mute">
          PDF, Word, text, Markdown, CSV, JSON or HTML, up to 25 MB each. Zebrain AI reads them, finds the topics, and writes
          questions and answers from them. No documents? It researches your job on the web instead.
        </span>
        <input id="docs" type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm" disabled={busy}
          onChange={(e) => { add(e.target.files); e.target.value = ""; }} className="sr-only" />
      </label>
      {err && <div className="mt-3"><ErrorNote message={err} /></div>}
      {docs.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {docs.map((d) => (
            <li key={d.path} className="zb-bubble flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 text-sm">
              <Icon name="file" className="h-5 w-5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 break-all">{d.name} <span className="text-mute">· {(d.bytes / 1024).toFixed(0)} KB</span></span>
              <button type="button" className="rounded-full p-1 text-mute hover:text-paper" aria-label={`Remove ${d.name}`} onClick={() => { play("click"); setDocs(docs.filter((x) => x.path !== d.path)); }}>
                <Icon name="x" className="h-4 w-4" />
              </button>
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
  if (!quotes) return (
    <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Working out the price">
      {[0, 1].map((i) => <div key={i} className="card"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-16 w-full" /></div>)}
    </div>
  );
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
          <button key={o.id} type="button" role="radio" aria-checked={on} disabled={bad} onClick={() => { if (!on) play("click"); setPlan(o.id); }} className="card">
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
