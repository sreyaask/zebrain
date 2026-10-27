import { NextResponse } from "next/server";
import { REGISTRY_VERSION, selectModel } from "@/lib/select";
import { paramsOf, quote, QuoteError, type Plan } from "@/lib/quote";
import { BASE_MODELS } from "@/lib/models";
import { services } from "@/lib/server/admin";
import { planModel } from "@/lib/server/planner";
import { shapeOf } from "@/lib/plan";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Plan → model → price, in that order. Qwen plans from the description (signed-in users, when Qwen is connected;
// otherwise the keyword reader does); the selector applies the hard requirements; the formula prices the pick.
export async function POST(req: Request) {
  const { description, purpose, plan, doc_tokens } = await req.json();
  const text = String(description || "").slice(0, 6000);
  if (!text.trim()) return NextResponse.json({ error: "Describe the model first." }, { status: 400 });
  const tier: Plan = ["trial", "basic", "standard", "extreme"].includes(plan) ? plan : "basic";
  const { data: { user } } = await supabaseServer().auth.getUser();
  const qwenAllowed = !!user && services().qwen && !rateLimited(`planner:${user.id}`, 20, 3600_000);

  const blueprint = await planModel(user?.id ?? null, text, String(purpose || ""), qwenAllowed);
  const selection = selectModel(blueprint.spec, tier);
  const base = selection.pick ? BASE_MODELS.find((m) => m.id === selection.pick!.id) : null;
  const price = (p: "standard" | "extreme") => {
    if (!base) return null;
    try {
      return quote({ plan: p, useCase: blueprint.spec.useCase, params: paramsOf(base.size), docTokens: Number(doc_tokens) || 0,
        ...shapeOf({ languages: blueprint.spec.languages, topics: blueprint.topics, sensitive: blueprint.sensitive }, blueprint.spec.minContext) });
    } catch (e) {
      return { error: e instanceof QuoteError ? e.message : "Couldn't price this model." };
    }
  };
  return NextResponse.json({
    blueprint, spec: blueprint.spec, ...selection, registryVersion: REGISTRY_VERSION,
    quotes: base ? { standard: price("standard"), extreme: price("extreme") } : null,
  });
}
