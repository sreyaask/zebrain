// Prices sample jobs end to end without calling Qwen: a sample plan (written to the planner prompt's rules) goes
// through the real plan checker, model selector and price formula. Run: node scripts/price-scenarios.mjs
import { load } from "../tests/load_ts.mjs";
const plan = await load("plan"), sel = await load("select"), q = await load("quote");

const legal = { summary: "Multilingual Indian legal information assistant.", use_case: "qa", languages: ["English", "Hindi", "Tamil", "Telugu", "Kannada"],
  min_context_tokens: 100000, priority: "quality", sensitive: true,
  topics: ["Constitution basics", "Criminal law (BNS)", "Consumer rights", "Property and tenancy", "Family law", "Labour law", "Reading judgments", "Courts and procedure"].map((t) => ({ topic: t, cover: "" })),
  refuse: ["final legal opinions"], dataset_notes: "Plain language; cite the Act; suggest a lawyer.", questions: [] };
const cases = [
  { name: "BEST: English shoe-shop support bot, 2 short PDFs", purpose: "Customer support", docTokens: 25000,
    text: "A support bot for my online shoe store in English. I'll upload our FAQ and returns policy.",
    plan: { summary: "English support bot for a shoe store.", use_case: "support", languages: ["English"], inputs: ["text"], min_context_tokens: 8000, priority: "balanced",
      topics: ["Orders", "Returns", "Exchanges", "Sizing", "Shipping", "Payments", "Damaged items", "Contact"].map((t) => ({ topic: t, cover: "" })), sensitive: false, questions: [] } },
  { name: "WORST: 5-language legal helper with photos (needs images)", purpose: "Research Q&A", docTokens: 0,
    text: "Indian law helper in Hindi, Tamil, Telugu, Kannada and English, reads 100k-token judgments, best quality, reads photos.",
    plan: { ...legal, inputs: ["text", "image"] } },
  { name: "WORST, FEASIBLE: same legal helper, text only", purpose: "Research Q&A", docTokens: 0,
    text: "Indian law helper in Hindi, Tamil, Telugu, Kannada and English, reads 100k-token judgments, best quality.", plan: { ...legal, inputs: ["text"] } },
];
for (const c of cases) {
  const bp = plan.validatePlan(c.plan, sel.parseSpec(c.text, c.purpose));
  console.log(`\n== ${c.name}\n   ${bp.spec.languages.length} language(s), ${bp.topics.length} topics, ${bp.sensitive ? "sensitive" : "not sensitive"}, ${bp.spec.minContext / 1000}K context`);
  for (const tier of ["standard", "extreme"]) {
    const r = sel.selectModel(bp.spec, tier);
    if (!r.pick) { console.log(`   ${tier}: no model. ${r.explanation}`); continue; }
    const x = q.quote({ plan: tier, useCase: bp.spec.useCase, params: r.pick.params, docTokens: c.docTokens,
      ...plan.shapeOf({ languages: bp.spec.languages, topics: bp.topics, sensitive: bp.sensitive }, bp.spec.minContext) });
    console.log(`   ${tier.padEnd(8)} ${r.pick.name.padEnd(11)} $${String(x.price).padEnd(6)} ${String(x.examples).padStart(6)} examples · GPU ${x.gpu.name} ${x.gpu.hours}h $${x.gpu.cost} · Qwen $${x.qwen.cost}`
      + ` · cost $${x.cost} → profit $${(x.price * 0.9646 - x.cost).toFixed(2)} (if estimates run high: $${x.profit})`);
    for (const w of x.warnings) console.log(`            ⚠ ${w}`);
  }
}
