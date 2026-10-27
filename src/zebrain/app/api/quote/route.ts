import { NextResponse } from "next/server";
import { BASE_MODELS } from "@/lib/models";
import { paramsOf, quote, QuoteError } from "@/lib/quote";
import { jobInputs } from "@/lib/plan";

// Both Pro prices for one model: what the job will cost (GPU + Qwen + search) plus margin.
export async function POST(req: Request) {
  // `job` is the same {purpose, blueprint, selection} the run will carry, so this price is the one charged.
  const { base_model, purpose, doc_tokens, job } = await req.json();
  const base = BASE_MODELS.find((m) => m.id === base_model);
  if (!base) return NextResponse.json({ error: "Unknown base model." }, { status: 400 });
  const { useCase, shape } = jobInputs({ purpose: String(job?.purpose ?? purpose ?? ""), blueprint: job?.blueprint, selection: job?.selection });
  const params = paramsOf(base.size);
  const one = (plan: "standard" | "extreme") => {
    try {
      return quote({ plan, useCase, params, docTokens: Number(doc_tokens) || 0, ...shape });
    } catch (e) {
      return { error: e instanceof QuoteError ? e.message : "Couldn't price this model." };
    }
  };
  return NextResponse.json({ useCase, standard: one("standard"), extreme: one("extreme") });
}
