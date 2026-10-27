"use client";

import { useCallback, useEffect, useState } from "react";
import { buyCredits } from "../new/PlanPieces";

type Entry = { id: number; delta: number; kind: string; ref: string | null; balance_after: number; meta: Record<string, unknown>; created_at: string };
type Pack = { id: string; credits: number; bonus_credits: number; price_cents: number; currency: string };
type Budget = { id: string; plan: string; model_name: string; data_limit: number; data_used: number; test_limit: number; test_used: number; created_at: string };
type Wallet = { balance: number; ledger: Entry[]; packs: Pack[]; budgets: Budget[] };

const KIND: Record<string, string> = { purchase: "Bought credits", promo: "Promotional credits", charge: "Model", refund: "Refund", adjust: "Adjustment by Zebrain" };

export default function WalletPage() {
  const [w, setW] = useState<Wallet | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [buying, setBuying] = useState<string | null>(null);
  const [country, setCountry] = useState<"INTL" | "IN">("INTL");
  const load = useCallback(() => {
    fetch("/api/wallet").then((r) => r.json()).then((d) => (d.error ? setErr(d.error) : setW(d))).catch(() => setErr("Couldn't load your wallet."));
  }, []);
  useEffect(load, [load]);

  async function buy(id: string) {
    setBuying(id);
    setErr("");
    setMsg("");
    try {
      await buyCredits(id, country);
      setMsg("Payment confirmed. Your credits are in your wallet.");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The payment didn't go through.");
    } finally {
      setBuying(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <header className="pb-8 pt-14 md:pt-20">
        <h1 className="mb-3 text-4xl font-medium tracking-tight md:text-5xl">Wallet</h1>
        <p className="max-w-[60ch] text-lg text-mute">Pro models are paid from your credits. 1 credit = $0.01. Free trial and Basic models don&apos;t use credits.</p>
      </header>

      <section aria-label="Balance" className="mb-12 border-t border-line pt-6">
        <p className="text-sm text-mute">Available</p>
        <p className="text-6xl font-medium tabular-nums tracking-tight">{w ? w.balance.toLocaleString() : "–"}<span className="ml-3 text-xl text-mute">credits</span></p>
        {w && <p className="mt-1 text-sm text-mute tabular-nums">${(w.balance / 100).toFixed(2)}</p>}
      </section>

      {err && <p role="alert" className="mb-6 text-sm text-bad">{err}</p>}
      {msg && <p role="status" className="mb-6 text-sm">{msg}</p>}

      <section aria-label="Buy credits" className="mb-14">
        <h2 className="mb-4 text-2xl font-medium">Add credits</h2>
        <fieldset className="mb-4">
          <legend className="label">Where are you buying from?</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={country === "INTL"} onClick={() => setCountry("INTL")} className={`chip ${country === "INTL" ? "chip-on" : ""}`}>Outside India (USD)</button>
            <button type="button" aria-pressed={country === "IN"} onClick={() => setCountry("IN")} className={`chip ${country === "IN" ? "chip-on" : ""}`}>India (₹, + 18% GST)</button>
          </div>
        </fieldset>
        <ul className="border-t border-line">
          {(w?.packs ?? []).map((p) => (
            <li key={p.id} className="grid items-center gap-3 border-b border-line py-4 sm:grid-cols-[1fr_auto_auto]">
              <span className="text-lg tabular-nums">
                {(p.credits + p.bonus_credits).toLocaleString()} credits
                {p.bonus_credits > 0 && <span className="ml-2 text-sm text-mute">includes {p.bonus_credits.toLocaleString()} bonus</span>}
              </span>
              <span className="tabular-nums text-mute">${(p.price_cents / 100).toFixed(2)}{country === "IN" ? " + GST" : ""}</span>
              <button className="btn" onClick={() => buy(p.id)} disabled={!!buying}>{buying === p.id ? "Opening Razorpay…" : "Buy"}</button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-mute">
          {country === "IN" ? "Charged in rupees with 18% GST added at checkout (UPI, cards, netbanking)." : "Charged in US dollars by card. No GST outside India."}{" "}
          Credits arrive only after Razorpay confirms the payment.
        </p>
      </section>

      <section aria-label="AI usage" className="mb-14">
        <h2 className="mb-4 text-2xl font-medium">AI tokens by model</h2>
        {w && w.budgets.length === 0 && <p className="text-sm text-mute">No models with AI-written data yet.</p>}
        <ul className="border-t border-line text-sm">
          {(w?.budgets ?? []).map((b) => {
            const used = b.data_used + b.test_used;
            const limit = b.data_limit + b.test_limit;
            return (
              <li key={b.id} className="grid gap-1 border-b border-line py-3 sm:grid-cols-[1fr_auto]">
                <span>{b.model_name} <span className="text-mute">· {b.plan === "trial" ? "free trial" : b.plan === "extreme" ? "Pro Extreme" : "Pro"}</span></span>
                <span className="tabular-nums text-mute">{(used / 1e6).toFixed(2)}M of {(limit / 1e6).toFixed(2)}M tokens</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="History">
        <h2 className="mb-4 text-2xl font-medium">History</h2>
        {w && w.ledger.length === 0 && <p className="text-sm text-mute">Nothing yet. Buy credits above, then choose Pro when you make a model.</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead><tr className="text-left text-[13px] text-mute">{["When", "What", "Credits", "Balance"].map((h) => <th key={h} className="border-b border-line py-2 pr-4 font-normal">{h}</th>)}</tr></thead>
            <tbody>
              {(w?.ledger ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="border-b border-line py-2.5 pr-4 text-mute">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="border-b border-line py-2.5 pr-4">{KIND[e.kind] ?? e.kind}{e.kind === "charge" && e.meta?.model ? `: ${String(e.meta.model)}` : ""}</td>
                  <td className={`border-b border-line py-2.5 pr-4 tabular-nums ${e.delta < 0 ? "" : "text-accent"}`}>{e.delta > 0 ? "+" : ""}{e.delta.toLocaleString()}</td>
                  <td className="border-b border-line py-2.5 tabular-nums">{e.balance_after.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
