import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { supabaseAdmin } from "./admin";

// Credits: 1 credit = US$0.01. Balances move only through wallet_apply in the database (atomic, idempotent, never
// negative), so the browser can never set a price or a balance.
export const PRICING_VERSION = "2026-10-27";
export const toCredits = (usd: number) => Math.round(usd * 100);

export class InsufficientCredits extends Error {
  constructor(public need: number, public have: number) {
    super(`This needs ${need.toLocaleString()} credits and your wallet has ${have.toLocaleString()}. Add credits to continue.`);
  }
}

export async function balanceOf(userId: string) {
  const { data } = await supabaseAdmin().from("credit_wallets").select("balance").eq("user_id", userId).maybeSingle();
  return Number(data?.balance ?? 0);
}

export async function applyCredits(userId: string, delta: number, kind: "purchase" | "promo" | "charge" | "refund" | "adjust",
  ref: string, key: string, meta: Record<string, unknown> = {}, by = "system") {
  const { data, error } = await supabaseAdmin().rpc("wallet_apply", {
    p_user: userId, p_delta: delta, p_kind: kind, p_ref: ref, p_key: key, p_meta: meta, p_pricing: PRICING_VERSION, p_by: by,
  });
  if (error) {
    if (/insufficient_credits/.test(error.message)) throw new InsufficientCredits(-delta, await balanceOf(userId));
    throw new Error(error.message);
  }
  return Number(data);
}
