import { NextResponse } from "next/server";
import { services } from "@/lib/server/admin";
import { supabaseServer } from "@/lib/supabase/server";

// What the signed-in user can pick when creating a model: is the free trial still theirs, which paid models are
// waiting to be trained, and which parts of Zebrain are switched on.
export async function GET() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const [{ data: trial }, { data: orders }, { data: qwen }] = await Promise.all([
    sb.from("free_trials").select("created_at").eq("user_id", user.id).maybeSingle(),
    sb.from("orders").select("id, plan, model_name, base_model, use_case, amount_cents, currency, status, created_at")
      .eq("user_id", user.id).eq("status", "paid").order("created_at", { ascending: false }),
    sb.from("service_status").select("up").eq("service", "qwen").maybeSingle(),
  ]);
  return NextResponse.json({ trialAvailable: !trial, paidOrders: orders ?? [], services: services(), qwenUp: qwen?.up !== false });
}
