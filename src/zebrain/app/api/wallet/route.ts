import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// The signed-in user's balance, packs on sale and history, read under row-level security (their rows only).
export async function GET() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const [w, ledger, packs, usage] = await Promise.all([
    sb.from("credit_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    sb.from("credit_ledger").select("id, delta, kind, ref, balance_after, meta, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    sb.from("credit_packages").select("id, credits, bonus_credits, price_cents, currency").eq("active", true).order("credits"),
    sb.from("token_budgets").select("id, plan, model_name, data_limit, data_used, test_limit, test_used, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  return NextResponse.json({ balance: Number(w.data?.balance ?? 0), ledger: ledger.data ?? [], packs: packs.data ?? [], budgets: usage.data ?? [] });
}
