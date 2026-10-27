import { NextResponse } from "next/server";
import { MissingKeys, supabaseAdmin } from "@/lib/server/admin";
import { removePod } from "@/lib/server/runpod";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Cancels a run on Zebrain's GPUs: stops the pod and cuts off its AI budget. Credits are not refunded once a run has
// started (users are told before they pay).
export async function POST(req: Request) {
  const { runId, kernel } = await req.json().catch(() => ({}));
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  // Row-level security limits this to the user's own runs; only the server creates rows that point at pods.
  const { data: run } = await sb.from("runs").select("id, kernel, final_stage").eq("run_id", String(runId)).eq("kernel", String(kernel)).maybeSingle();
  if (!run || !run.kernel.startsWith("runpod:")) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (run.final_stage) return NextResponse.json({ error: "This run has already finished." }, { status: 400 });
  try {
    const db = supabaseAdmin();
    await removePod(run.kernel.slice("runpod:".length)).catch(() => {}); // already gone is fine
    const { data: charge } = await db.from("credit_ledger").select("meta").eq("idempotency_key", `run:${runId}`).maybeSingle();
    if (charge?.meta?.budget_id) await db.from("run_tokens").delete().eq("budget_id", charge.meta.budget_id);
    await db.from("runs").update({ final_stage: "failed" }).eq("id", run.id);
    await db.from("audit_log").insert({ actor: user.email ?? user.id, action: "cancel_run", target: String(runId), meta: { kernel: run.kernel } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MissingKeys) return NextResponse.json({ error: e.message }, { status: 503 });
    throw e;
  }
}
