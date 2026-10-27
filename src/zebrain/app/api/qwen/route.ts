import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { AppBudgetReached, BudgetExhausted, ChatMessage, qwenChat } from "@/lib/server/qwen";
import { MissingKeys, supabaseAdmin } from "@/lib/server/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

// The training job's only way to Qwen. It sends its run token; the server finds the model's budget from the token's
// hash, checks it hasn't expired, and spends from that budget. The Qwen key never leaves the server.
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Missing run token." }, { status: 401 });
  try {
    const db = supabaseAdmin();
    const hash = createHash("sha256").update(token).digest("hex");
    const { data: rt } = await db.from("run_tokens").select("budget_id, expires_at").eq("token_hash", hash).maybeSingle();
    if (!rt || new Date(rt.expires_at) < new Date()) return NextResponse.json({ error: "Run token expired or unknown." }, { status: 401 });
    const body = await req.json();
    const bucket = body.bucket === "test" ? "test" : "data";
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(0, 20)
      .filter((m: ChatMessage) => ["system", "user", "assistant"].includes(m?.role) && typeof m.content === "string") as ChatMessage[];
    if (!messages.length) return NextResponse.json({ error: "No messages." }, { status: 400 });
    const out = await qwenChat(rt.budget_id, bucket, messages, {
      maxTokens: Math.min(Number(body.max_tokens) || 4000, 8000), json: !!body.json, search: !!body.search,
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
    });
    const { data: b } = await db.from("token_budgets").select("data_limit, data_used, test_limit, test_used").eq("id", rt.budget_id).single();
    return NextResponse.json({ ...out, left: b ? { data: b.data_limit - b.data_used, test: b.test_limit - b.test_used } : null });
  } catch (e) {
    if (e instanceof BudgetExhausted) return NextResponse.json({ error: e.message, exhausted: true }, { status: 402 });
    if (e instanceof AppBudgetReached) return NextResponse.json({ error: e.message, paused: true }, { status: 503 });
    if (e instanceof MissingKeys) return NextResponse.json({ error: e.message }, { status: 503 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "The AI request failed." }, { status: 502 });
  }
}
