import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { requireKeys, supabaseAdmin } from "./admin";
import { markDown, serviceStatus } from "./status";

// Qwen through Alibaba Cloud Model Studio's OpenAI-compatible API (Singapore). Every call reserves tokens from the
// model's budget first and settles the real usage after, so a model can never spend past what it paid for.
// Requests stay under 32K input tokens to keep qwen3.7-flash's cheapest price ($0.03 in / $0.13 out per 1M).

const BASE = process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
export const QWEN_MODEL = process.env.QWEN_MODEL || "qwen3.7-flash";
export const MAX_INPUT = 32_000;

export type Bucket = "data" | "test";
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class BudgetExhausted extends Error {
  constructor() {
    super("This model has used its AI token budget.");
  }
}

// Rough token count for budgeting before the call (the real count is settled afterwards).
export const estimateTokens = (text: string) => Math.ceil(text.length / 3.2);

export const OUT_OF_SERVICE = "Zebrain is out of service right now. Leave your email and we'll tell you as soon as we're back.";

export class AppBudgetReached extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

const PRICE_IN = Number(process.env.QWEN_PRICE_IN || 0.03) / 1e6;
const PRICE_OUT = Number(process.env.QWEN_PRICE_OUT || 0.13) / 1e6;
const PRICE_SEARCH = 0.01;

// Estimated Qwen spend today (UTC) from provider-reported usage, and the daily cap (0 = no cap).
export async function qwenSpendToday() {
  const db = supabaseAdmin();
  const { data: lim } = await db.from("app_limits").select("value").eq("key", "qwen_daily_usd_cap").maybeSingle();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const [{ data: rows }, { data: own }] = await Promise.all([
    db.from("token_ledger").select("prompt_tokens, completion_tokens, searched").gte("created_at", since.toISOString()),
    db.from("platform_usage").select("prompt_tokens, completion_tokens").gte("created_at", since.toISOString()),
  ]);
  const spent = (rows ?? []).reduce((n, r) => n + r.prompt_tokens * PRICE_IN + r.completion_tokens * PRICE_OUT + (r.searched ? PRICE_SEARCH : 0), 0)
    + (own ?? []).reduce((n, r) => n + r.prompt_tokens * PRICE_IN + r.completion_tokens * PRICE_OUT, 0);
  return { spent, cap: Number(lim?.value ?? 0) };
}

// Zebrain-wide guard on top of each model's budget: an admin pause switch and a daily spend cap (app_limits).
// Spend is estimated from provider-reported usage in token_ledger; calls already in flight can add at most one
// request each beyond the cap. Alibaba's own monthly budget ("stop service") is the hard outer limit.
export async function checkAppBudget() {
  const db = supabaseAdmin();
  const { data: limits } = await db.from("app_limits").select("key, value");
  const get = (k: string) => Number(limits?.find((l) => l.key === k)?.value ?? 0);
  if (get("qwen_paused") === 1) throw new AppBudgetReached("Qwen is paused by the administrator.");
  const st = await serviceStatus("qwen");
  if (!st.up) throw new AppBudgetReached(OUT_OF_SERVICE);
  const { spent, cap } = await qwenSpendToday();
  if (cap && spent >= cap) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { data: open } = await db.from("admin_alerts").select("id").eq("kind", "qwen_daily_cap").is("resolved_at", null).gte("created_at", since.toISOString()).limit(1);
    if (!open?.length) await db.from("admin_alerts").insert({ kind: "qwen_daily_cap", message: `Qwen spend today ($${spent.toFixed(2)}) reached the daily cap ($${cap}). New Qwen calls are blocked until tomorrow or until the cap is raised.` });
    await markDown("qwen", `Daily Qwen cap reached ($${spent.toFixed(2)} of $${cap})`);
    throw new AppBudgetReached(OUT_OF_SERVICE);
  }
}

export async function qwenChat(budgetId: string, bucket: Bucket, messages: ChatMessage[], opts: { maxTokens?: number; json?: boolean; search?: boolean; temperature?: number } = {}) {
  requireKeys("QWEN_API_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const input = estimateTokens(messages.map((m) => m.content).join("\n"));
  if (input > MAX_INPUT) throw new Error(`Request too long for the cheap price tier (${input} tokens > ${MAX_INPUT}).`);
  await checkAppBudget();
  const db = supabaseAdmin();
  const { data: got, error } = await db.rpc("reserve_tokens", { p_budget: budgetId, p_bucket: bucket, p_want: input + (opts.maxTokens ?? 4000) });
  if (error) throw new Error(error.message);
  const want = Number(got) || 0;
  // Near the end of a budget, answer shorter instead of refusing; stop only when there's no room for a real answer.
  if (want < input + 256) {
    if (want) await settle(budgetId, bucket, want, 0, 0, false);
    throw new BudgetExhausted();
  }
  const used = { prompt: 0, completion: 0 };
  try {
    return await callQwen(messages, { ...opts, maxTokens: want - input }, used);
  } finally {
    await settle(budgetId, bucket, want, used.prompt, used.completion, !!opts.search);
  }
}

// One request to Model Studio. `used` gets the provider-reported token counts even when the request fails.
async function callQwen(messages: ChatMessage[], opts: { maxTokens: number; json?: boolean; search?: boolean; temperature?: number },
  used: { prompt: number; completion: number }): Promise<{ text: string; prompt: number; completion: number }> {
  try {
    return await callQwenOnce(messages, opts, used);
  } catch (e) {
    if (e instanceof AppBudgetReached || !(opts.json || opts.search) || !/response_format|json|enable_search|search/i.test(String(e))) throw e;
    return callQwenOnce(messages, { ...opts, json: false, search: false }, used); // prompts already ask for JSON only
  }
}

async function callQwenOnce(messages: ChatMessage[], opts: { maxTokens: number; json?: boolean; search?: boolean; temperature?: number },
  used: { prompt: number; completion: number }) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.QWEN_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(240_000),
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.7,
      enable_thinking: false, // reasoning tokens bill as output; dataset writing doesn't need them
      ...(opts.search ? { enable_search: true } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  used.prompt = data?.usage?.prompt_tokens ?? 0;
  used.completion = data?.usage?.completion_tokens ?? 0;
  if (!res.ok) {
    const code = String(data?.error?.code || "");
    const msg = String(data?.error?.message || code || `Qwen answered ${res.status}.`);
    // Account-level problems (unpaid bill, quota, Alibaba's budget stop, a revoked key) won't fix themselves by
    // retrying: mark Qwen out of service and tell the admin. Ordinary request errors are passed back as they are.
    if (/arrear|overdue|quota|insufficient.?balance|service.?(stopped|suspended)|account.*(suspend|disabled)|budget.?(reached|exceeded)/i.test(`${code} ${msg}`)
      || res.status === 401 || res.status === 403) {
      await markDown("qwen", `Alibaba error ${res.status}: ${msg}`);
      throw new AppBudgetReached(OUT_OF_SERVICE);
    }
    throw new Error(msg);
  }
  return { text: String(data.choices?.[0]?.message?.content ?? ""), prompt: used.prompt, completion: used.completion };
}

// Qwen work Zebrain does for itself before anyone pays (planning a model). Not charged to a model's budget, but
// counted in the daily cap and logged per user for the admin.
export async function qwenPlatform(userId: string | null, purpose: string, promptVersion: string, messages: ChatMessage[], opts: { maxTokens: number; json?: boolean; temperature?: number }) {
  requireKeys("QWEN_API_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const input = estimateTokens(messages.map((m) => m.content).join("\n"));
  if (input > MAX_INPUT) throw new Error(`Request too long (${input} tokens > ${MAX_INPUT}).`);
  await checkAppBudget();
  const used = { prompt: 0, completion: 0 };
  try {
    return await callQwen(messages, opts, used);
  } finally {
    await supabaseAdmin().from("platform_usage").insert({
      user_id: userId, purpose, model: QWEN_MODEL, prompt_tokens: used.prompt, completion_tokens: used.completion, prompt_version: promptVersion,
    });
  }
}

async function settle(budgetId: string, bucket: Bucket, reserved: number, prompt: number, completion: number, searched: boolean) {
  await supabaseAdmin().rpc("settle_tokens", {
    p_budget: budgetId, p_bucket: bucket, p_reserved: reserved, p_prompt: prompt, p_completion: completion,
    p_model: QWEN_MODEL, p_searched: searched,
  });
}

// A new token budget for one model: 85% for writing data, 15% for testing.
export async function createBudget(userId: string, plan: string, modelName: string, tokens: number) {
  const { data, error } = await supabaseAdmin().from("token_budgets").insert({
    user_id: userId, plan, model_name: modelName,
    data_limit: Math.round(tokens * 0.85), test_limit: Math.round(tokens * 0.15),
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
