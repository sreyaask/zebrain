// Plans and the automatic Pro price. Free models train on the user's own Kaggle; Pro models train on Zebrain's
// RunPod GPUs with a Qwen-written dataset, priced per model from what the job will actually cost.
// The formula and constants come from reports/Zebrain pricing and dataset pipeline.md. GPU speeds are estimates
// (±40%) until timing runs replace them, so costs carry buffers and the margin is added on top.

export type Plan = "trial" | "basic" | "standard" | "extreme";

export const PLANS: Record<Plan, {
  name: string;
  maxParams: number; // largest base model, billions of parameters
  gpu: "kaggle" | "runpod";
  qwenTokens: number | null; // dataset-writing budget; null = Qwen only picks existing datasets
  tests: boolean;
  summary: string;
}> = {
  trial: {
    name: "Free trial",
    maxParams: 9,
    gpu: "kaggle",
    qwenTokens: 2_000_000,
    tests: true,
    summary: "One model, once. Qwen writes your dataset, tests the model and publishes it. No card needed.",
  },
  basic: {
    name: "Basic",
    maxParams: 9,
    gpu: "kaggle",
    qwenTokens: null,
    tests: false,
    summary: "Free, on your own Kaggle GPU. Qwen picks existing datasets for your job. No testing round.",
  },
  standard: {
    name: "Pro",
    maxParams: 9,
    gpu: "runpod",
    qwenTokens: null, // set per quote
    tests: true,
    summary: "Good results. Qwen writes a focused dataset from your prompt and documents, trains on our GPUs and tests it.",
  },
  extreme: {
    name: "Pro Extreme",
    maxParams: 14,
    gpu: "runpod",
    qwenTokens: null,
    tests: true,
    summary: "Best results. A dataset about four times bigger, stricter checks, and larger models up to 14B.",
  },
};

// Dataset size per use case: L = training tokens per example, N = kept examples.
export const USE_CASES = {
  support: { label: "Support bot", L: 1300, standard: 1500, extreme: 6000 },
  coding: { label: "Coding", L: 1200, standard: 3000, extreme: 10000 },
  sql: { label: "SQL", L: 1000, standard: 2500, extreme: 10000 },
  qa: { label: "Questions about documents", L: 900, standard: 1500, extreme: 6000 },
  persona: { label: "Persona chat", L: 500, standard: 800, extreme: 2500 },
  extraction: { label: "Extraction / JSON", L: 500, standard: 800, extreme: 4000 },
} as const;
export type UseCase = keyof typeof USE_CASES;

// The wizard's purposes mapped onto the priced use cases.
export function useCaseFor(purpose: string): UseCase {
  const p = purpose.toLowerCase();
  if (p.includes("sql")) return "sql";
  if (p.includes("cod")) return "coding";
  if (p.includes("support")) return "support";
  if (p.includes("extract") || p.includes("json") || p.includes("classif")) return "extraction";
  if (p.includes("writing") || p.includes("persona") || p.includes("general")) return "persona";
  return "qa"; // tutor, research Q&A and anything document-based
}

// RunPod Secure Cloud on-demand prices (runpod.io/pricing, updated 2026-10-08), peak bf16 TFLOPs and the share of
// it LoRA training reaches (MFU, estimated).
export const GPUS = [
  { id: "NVIDIA RTX A5000", name: "RTX A5000", vram: 24, perHour: 0.27, tflops: 111, mfu: 0.22 },
  { id: "NVIDIA RTX A6000", name: "RTX A6000", vram: 48, perHour: 0.59, tflops: 155, mfu: 0.22 },
  { id: "NVIDIA L40S", name: "L40S", vram: 48, perHour: 1.09, tflops: 362, mfu: 0.22 },
  { id: "NVIDIA A100 80GB PCIe", name: "A100 80GB", vram: 80, perHour: 1.79, tflops: 312, mfu: 0.28 },
  { id: "NVIDIA H100 PCIe", name: "H100", vram: 80, perHour: 2.89, tflops: 756, mfu: 0.25 },
] as const;

const QWEN_IN = 0.03 / 1e6; // qwen3.7-flash, requests up to 32K tokens
const QWEN_OUT = 0.13 / 1e6;
const K = { standard: { in: 6, out: 2.5, searches: 30, maxHours: 3, profit: 3 }, extreme: { in: 15, out: 5, searches: 150, maxHours: 6, profit: 7 } };
const SEARCH = 0.01; // per web search
const EMBED = 0.07 / 1e6;
const OPS = 0.5; // storage, eval pass, upload, share of failed jobs (assumption until logged)
// Card fee incl. 18% GST on the fee, plus a 1% reserve for refunds. GST charged to Indian buyers is added on top of
// the price at checkout and passed to the government, so it never comes out of this margin.
const REFUND_RESERVE = 0.01;
const FEE = { international: 0.0354 + REFUND_RESERVE, domestic: 0.0236 + REFUND_RESERVE };
const STANDARD_FLOOR = 4.99;

export type Quote = {
  plan: "standard" | "extreme";
  useCase: UseCase;
  params: number;
  examples: number;
  epochs: number;
  gpu: { id: string; name: string; count: number; hours: number; cost: number };
  qwen: { inputTokens: number; outputTokens: number; searches: number; cost: number };
  cost: number; // expected cost before buffers
  bufferedCost: number;
  price: number; // USD, ends in .99
  profit: number; // at the buffered cost, after the card fee
  languages: number;
  warnings: string[]; // things the user must know before paying
};

// What the planner found, which changes how much data a job needs. Same inputs → same price everywhere.
export type JobShape = { languages?: number; topics?: number; sensitive?: boolean; minContext?: number };

export const MAX_TRAIN_TOKENS = 1536; // longest training example the job keeps (lib/zebrain_train.py max_len)

// Every extra language adds half the base dataset (each needs its own examples), up to 3× at 5+ languages.
export const languageFactor = (n = 1) => Math.min(3, 1 + 0.5 * (Math.max(1, n) - 1));
// Each planned topic needs enough examples to be learned, not just mentioned.
const PER_TOPIC = { standard: 80, extreme: 300 };
const MAX_EXAMPLES = 30_000;

// Kept examples for a job: the use case's base size × languages, never fewer than the planned topics need.
export function examplesFor(plan: "standard" | "extreme", useCase: UseCase, shape: JobShape = {}) {
  const lf = languageFactor(shape.languages);
  const base = USE_CASES[useCase][plan] * lf;
  const byTopics = (shape.topics ?? 0) * PER_TOPIC[plan] * lf;
  return Math.min(MAX_EXAMPLES, Math.round(Math.max(base, byTopics) / 50) * 50);
}

export class QuoteError extends Error {}

// Pro price for one model. docTokens = tokens in uploaded documents (0 = none, so Qwen searches the web instead).
export function quote(opts: { plan: "standard" | "extreme"; useCase: UseCase; params: number; docTokens?: number; card?: keyof typeof FEE } & JobShape): Quote {
  const { plan, useCase, params: P } = opts;
  const D = opts.docTokens ?? 0;
  // Sensitive jobs (legal, medical, money) always get the strict judge: more rejected drafts, so more Qwen tokens.
  const strict = plan === "extreme" || !!opts.sensitive;
  const k = { ...K[plan], in: K[plan].in * (opts.sensitive ? 1.2 : 1), out: K[plan].out * (opts.sensitive ? 1.2 : 1) };
  if (P > PLANS[plan].maxParams) throw new QuoteError(`${PLANS[plan].name} trains models up to ${PLANS[plan].maxParams}B parameters.`);
  const uc = USE_CASES[useCase];
  const N = examplesFor(plan, useCase, opts);
  const warnings: string[] = [];
  if ((opts.minContext ?? 0) > 16_000)
    warnings.push(`Your job needs about ${Math.round((opts.minContext ?? 0) / 1000)}K tokens of text at once. Training examples are up to ${MAX_TRAIN_TOKENS.toLocaleString()} tokens, so the model learns your job from shorter passages; on Kaggle's free GPU, very long documents may not fit in memory when chatting.`);
  if (opts.sensitive) warnings.push("This job gives legal, medical or financial information, so every answer gets the strict quality check and a note to consult a professional.");
  if ((opts.languages ?? 1) > 1 && !strict) warnings.push(`The dataset is split across ${opts.languages} languages; Extreme gives each language about four times more examples.`);
  const epochs = N <= 5000 ? 3 : 2;
  const trainTokens = N * uc.L * epochs;

  // GPU: cheapest card with enough memory that finishes in time; two of the cheapest only if none can alone.
  const vram = 1.25 * (2.4 * P + 2);
  const overhead = (5 + 1.1 * P) / 60;
  const options = GPUS.filter((g) => g.vram >= vram).map((g) => {
    const tps = (g.mfu * g.tflops * 1e12) / (6 * P * 1e9) * (P < 2 ? 0.6 : 1);
    const hours = trainTokens / tps / 3600 + overhead;
    return { g, tps, hours, cost: hours * g.perHour };
  });
  if (!options.length) throw new QuoteError(`No single GPU has the ${Math.ceil(vram)} GB a ${P}B model needs.`);
  const fits = options.filter((o) => o.hours <= k.maxHours).sort((a, b) => a.cost - b.cost);
  let gpu: Quote["gpu"];
  if (fits.length) {
    const o = fits[0];
    gpu = { id: o.g.id, name: o.g.name, count: 1, hours: o.hours, cost: o.cost };
  } else {
    const o = options.sort((a, b) => a.g.perHour - b.g.perHour)[0];
    const hours = (o.hours - overhead) / 1.8 + overhead;
    gpu = { id: o.g.id, name: o.g.name, count: 2, hours, cost: hours * o.g.perHour * 2 };
  }

  const inputTokens = Math.round(N * uc.L * k.in + 2 * D);
  const outputTokens = Math.round(N * uc.L * k.out + 0.3 * D);
  const searches = D > 0 ? 0 : k.searches;
  const qwenCost = inputTokens * QWEN_IN + outputTokens * QWEN_OUT;
  const embed = N * 2 * 150 * EMBED;
  const searchCost = searches * SEARCH;

  const cost = gpu.cost + qwenCost + embed + searchCost + OPS;
  const bufferedCost = 1.5 * gpu.cost + 1.3 * (qwenCost + embed) + searchCost + OPS;
  const fee = FEE[opts.card ?? "international"];
  let price = Math.ceil((bufferedCost + k.profit) / (1 - fee) - 0.99) + 0.99;
  if (plan === "standard") price = Math.max(price, STANDARD_FLOOR);
  price = Math.round(price * 100) / 100;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    plan, useCase, params: P, examples: N, epochs,
    gpu: { ...gpu, hours: r2(gpu.hours), cost: r2(gpu.cost) },
    qwen: { inputTokens, outputTokens, searches, cost: r2(qwenCost + searchCost) },
    cost: r2(cost),
    bufferedCost: r2(bufferedCost),
    price,
    profit: r2(price * (1 - fee) - bufferedCost),
    languages: Math.max(1, opts.languages ?? 1),
    warnings,
  };
}

// "9B" / "3.8B" / "4B" → 9 / 3.8 / 4.
export const paramsOf = (size: string) => parseFloat(size) || 0;
