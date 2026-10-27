"use client";

import { useEffect, useState } from "react";

// Shown on every page while Zebrain's AI service is down (Alibaba's spending stop or Zebrain's daily cap).
// Free Basic runs still work; new free trials and Pro runs wait. Visitors can leave an email for a "we're back" note.
export default function OutOfService() {
  const [down, setDown] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((d) => setDown(d?.qwen?.up === false)).catch(() => {});
  }, []);
  if (!down) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setErr("");
    const r = await fetch("/api/status/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setState("saved");
    else {
      setErr(d.error || "Couldn't save your email.");
      setState("idle");
    }
  }

  return (
    <div role="status" className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">We&apos;re out of service right now.</span>{" "}
          <span className="text-mute">New free trials and Pro models are paused. Basic still works on your own Kaggle GPU.</span>
        </p>
        {state === "saved" ? (
          <p className="text-sm">Thanks. We&apos;ll email you the moment we&apos;re back.</p>
        ) : (
          <form onSubmit={save} className="flex w-full flex-wrap gap-2 sm:w-auto">
            <label htmlFor="oos-email" className="sr-only">Email for a back-in-service note</label>
            <input id="oos-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" className="input min-w-0 flex-1 sm:w-64" aria-describedby={err ? "oos-err" : undefined} />
            <button className="btn" disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Email me when you're back"}</button>
            {err && <p id="oos-err" role="alert" className="w-full text-sm text-bad">{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
