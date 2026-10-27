import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { PLANNER_SYSTEM, PLANNER_VERSION } from "@/lib/ai/prompts";
export { PLANNER_VERSION };
import { parseSpec } from "@/lib/select";
import { type Blueprint, validatePlan } from "@/lib/plan";
import { qwenPlatform } from "./qwen";

const clean = (s: unknown, max = 300) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Qwen reads what the user wants and returns a structured plan: the job type, required languages, input types,
// context needs, priority, the topics the dataset must cover, and anything it needs to ask. Qwen plans; it never
// sets a price. The plan feeds the model selector and the price formula, which stay deterministic.



export async function planModel(userId: string | null, description: string, purpose: string, useQwen: boolean): Promise<Blueprint> {
  const fallback = parseSpec(description, purpose);
  const rules: Blueprint = {
    source: "rules", version: "rules", summary: "", spec: fallback, topics: [], refuse: [], sensitive: false, datasetNotes: "", questions: [],
  };
  if (!useQwen) return rules;
  try {
    const request = `Category the user picked: ${clean(purpose, 80) || "none"}\n<request>\n${description.slice(0, 6000).replace(/<\/request>/gi, "")}\n</request>`;
    const out = await qwenPlatform(userId, "plan_model", PLANNER_VERSION,
      [{ role: "system", content: PLANNER_SYSTEM }, { role: "user", content: request }], { maxTokens: 1500, json: true, temperature: 0.2 });
    const parsed = validatePlan(JSON.parse(out.text.replace(/^```(?:json)?\s*|\s*```$/g, "")), fallback);
    return parsed ? { source: "qwen", version: PLANNER_VERSION, ...parsed } : rules;
  } catch {
    return rules; // Qwen unavailable or replied badly: the keyword reader still gives a usable plan
  }
}
