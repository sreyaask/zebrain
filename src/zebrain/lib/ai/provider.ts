import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)

// The one switch for which AI backs Zebrain AI: AI_PROVIDER=qwen (default) | gemini. Every AI request on the server
// (the job gateway, the planner, dataset picking, health checks) goes through callAI, so prompts are identical
// whichever provider answers; only the transport changes. Users never see the provider's name.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type AIOptions = { maxTokens: number; json?: boolean; search?: boolean; temperature?: number };
export type AIResult = { text: string; prompt: number; completion: number };
export type Provider = "qwen" | "gemini";

export const provider = (): Provider => (process.env.AI_PROVIDER === "gemini" ? "gemini" : "qwen");
export const providerKeyName = () => (provider() === "gemini" ? "GEMINI_API_KEY" : "QWEN_API_KEY");
export const aiConfigured = () => !!process.env[providerKeyName()];
export function modelName() {
  return provider() === "gemini" ? geminiModel.chosen ?? process.env.GEMINI_MODEL ?? "gemini (auto)" : process.env.QWEN_MODEL || "qwen3.7-flash";
}

// The provider's account is unusable (unpaid bill, quota, spending stop, bad key): retrying won't help.
export class ProviderAccountError extends Error {}

const looksJSON = (t: string) => {
  try {
    JSON.parse(t.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
    return true;
  } catch {
    return false;
  }
};

// `used` receives the provider-reported token counts even when the request fails.
export async function callAI(messages: ChatMessage[], opts: AIOptions, used: { prompt: number; completion: number }): Promise<AIResult> {
  const once = provider() === "gemini" ? callGemini : callQwen;
  let out: AIResult;
  try {
    out = await once(messages, opts, used);
  } catch (e) {
    // A model that rejects JSON mode or search: retry once without them (the prompts already ask for JSON only).
    if (e instanceof ProviderAccountError || !(opts.json || opts.search) || !/response_format|json|mime|search|tool/i.test(String(e))) throw e;
    out = await once(messages, { ...opts, json: false, search: false }, used);
  }
  // Malformed JSON: retry once, cooler, before giving the caller something it can't parse.
  if (opts.json && !looksJSON(out.text)) {
    const before = { ...used };
    const again = await once(messages, { ...opts, temperature: 0.1 }, used);
    used.prompt += before.prompt;
    used.completion += before.completion;
    if (looksJSON(again.text)) return { ...again, prompt: used.prompt, completion: used.completion };
  }
  return out;
}

const ACCOUNT_PROBLEM = /arrear|overdue|quota|insufficient.?balance|service.?(stopped|suspended)|account.*(suspend|disabled)|budget.?(reached|exceeded)|api key not valid|permission_denied|billing/i;

// ---- Qwen (Alibaba Model Studio, OpenAI-compatible) ----
async function callQwen(messages: ChatMessage[], opts: AIOptions, used: { prompt: number; completion: number }): Promise<AIResult> {
  const base = process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.QWEN_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(240_000),
    body: JSON.stringify({
      model: process.env.QWEN_MODEL || "qwen3.7-flash",
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
    const msg = String(data?.error?.message || data?.error?.code || `The AI answered ${res.status}.`);
    if (ACCOUNT_PROBLEM.test(`${data?.error?.code ?? ""} ${msg}`) || res.status === 401 || res.status === 403) throw new ProviderAccountError(`${res.status}: ${msg}`);
    throw new Error(msg);
  }
  return { text: String(data.choices?.[0]?.message?.content ?? ""), prompt: used.prompt, completion: used.completion };
}

// ---- Gemini (Google AI Studio REST) ----
const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
const geminiModel: { chosen: string | null } = { chosen: null };

// GEMINI_MODEL if set, otherwise the newest stable gemini-X.Y-flash the key can use, so a retired name never breaks.
async function pickGeminiModel() {
  if (geminiModel.chosen) return geminiModel.chosen;
  if (process.env.GEMINI_MODEL) return (geminiModel.chosen = process.env.GEMINI_MODEL);
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! }, signal: AbortSignal.timeout(30_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ProviderAccountError(`${res.status}: ${data?.error?.message ?? "couldn't list models"}`);
  const names: string[] = (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m: { name: string }) => m.name.split("/").pop()!)
    .filter((n: string) => /^gemini-\d+(\.\d+)?-flash$/.test(n));
  names.sort((a, b) => parseFloat(b.split("-")[1]) - parseFloat(a.split("-")[1]));
  if (!names.length) throw new ProviderAccountError("no stable flash model available to this key");
  return (geminiModel.chosen = names[0]);
}

async function callGemini(messages: ChatMessage[], opts: AIOptions, used: { prompt: number; completion: number }): Promise<AIResult> {
  const model = await pickGeminiModel();
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const body = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    // Search grounding can't be combined with JSON mode; the prompts still ask for JSON only.
    ...(opts.search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      maxOutputTokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.7,
      ...(opts.json && !opts.search ? { responseMimeType: "application/json" } : {}),
    },
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(240_000),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    used.prompt = data?.usageMetadata?.promptTokenCount ?? 0;
    used.completion = (data?.usageMetadata?.candidatesTokenCount ?? 0) + (data?.usageMetadata?.thoughtsTokenCount ?? 0);
    if (res.status === 429 || res.status === 503) {
      if (/quota|billing/i.test(String(data?.error?.message)) && attempt === 2) throw new ProviderAccountError(`${res.status}: ${data?.error?.message}`);
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      const msg = String(data?.error?.message || `The AI answered ${res.status}.`);
      if (ACCOUNT_PROBLEM.test(msg) || res.status === 401 || res.status === 403) throw new ProviderAccountError(`${res.status}: ${msg}`);
      throw new Error(msg);
    }
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    return { text, prompt: used.prompt, completion: used.completion };
  }
  throw new Error("The AI is busy. Try again shortly.");
}
