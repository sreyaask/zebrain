import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { createClient } from "@supabase/supabase-js";

// Supabase with the service key, for writes users must not make themselves: payments, trials, token budgets.
// Server-only; never import this from a client component.
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new MissingKeys(["SUPABASE_SERVICE_ROLE_KEY"]);
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}

// Which parts of Zebrain are switched on, by the keys in .env.local. Pages use it to explain what's not ready yet.
export function services() {
  const has = (k: string) => !!process.env[k];
  return {
    payments: has("RAZORPAY_KEY_ID") && has("RAZORPAY_KEY_SECRET") && has("SUPABASE_SERVICE_ROLE_KEY"),
    qwen: has("QWEN_API_KEY") && has("SUPABASE_SERVICE_ROLE_KEY"),
    runpod: has("RUNPOD_API_KEY"),
    trials: has("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export class MissingKeys extends Error {
  constructor(public keys: string[]) {
    super(`Zebrain isn't set up for this yet (missing ${keys.join(", ")} on the server).`);
  }
}

export function requireKeys(...keys: string[]) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) throw new MissingKeys(missing);
}
