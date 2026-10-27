// Checks the automatic Pro price against the report's worked examples and the plan rules.
// Run: node tests/test_quote.mjs
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "../lib/quote.ts"), "utf8");
const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const tmp = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "zbq-")), "quote.mjs");
fs.writeFileSync(tmp, out);
const q = await import(pathToFileURL(tmp));

let fails = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : `  -> ${detail}`)); if (!ok) fails++; };

const s = q.quote({ plan: "standard", useCase: "support", params: 9, docTokens: 100000 });
const e = q.quote({ plan: "extreme", useCase: "support", params: 9, docTokens: 100000 });
check("9B support Standard ≈ report's $7.99", s.price >= 6.99 && s.price <= 8.99, JSON.stringify(s));
check("9B support Extreme ≈ report's $24.99", e.price >= 22.99 && e.price <= 26.99, JSON.stringify(e));
for (const plan of ["standard", "extreme"]) for (const uc of Object.keys(q.USE_CASES)) for (const P of [1.5, 4, 9, 14]) {
  if (P > q.PLANS[plan].maxParams) continue;
  const r = q.quote({ plan, useCase: uc, params: P });
  const min = plan === "extreme" ? 7 : 3;
  if (!(r.profit >= min - 0.01 && String(r.price).endsWith(".99"))) check(`${plan} ${uc} ${P}B profit ≥ $${min}, price ends .99`, false, JSON.stringify(r));
}
check("every quote keeps the plan's minimum profit and .99 prices", true);
check("Extreme profit is at least $7 after fees", q.quote({ plan: "extreme", useCase: "coding", params: 14 }).profit >= 7);
check("Standard has a $4.99 floor", q.quote({ plan: "standard", useCase: "persona", params: 1.5 }).price === 4.99);
check("9B gets a 48 GB card, 4B the cheap 24 GB one",
  q.quote({ plan: "standard", useCase: "qa", params: 9 }).gpu.name !== "RTX A5000" && q.quote({ plan: "standard", useCase: "qa", params: 4 }).gpu.name === "RTX A5000");
let threw = false;
try { q.quote({ plan: "standard", useCase: "qa", params: 14 }); } catch (err) { threw = err instanceof q.QuoteError; }
check("Standard refuses models above 9B (Extreme goes to 14B)", threw);
check("no documents adds web searches", q.quote({ plan: "standard", useCase: "qa", params: 4 }).qwen.searches === 30);
check("purposes map to priced use cases", q.useCaseFor("SQL assistant") === "sql" && q.useCaseFor("Customer support") === "support" && q.useCaseFor("Tutor") === "qa");

// Languages, topics and sensitivity change the dataset size, and therefore the price.
const one = q.quote({ plan: "standard", useCase: "qa", params: 9 });
const five = q.quote({ plan: "standard", useCase: "qa", params: 9, languages: 5 });
check("5 languages → 3× the examples of 1", five.examples === one.examples * 3, `${one.examples} vs ${five.examples}`);
check("more languages cost more", five.price > one.price, `${one.price} vs ${five.price}`);
check("2 languages → 1.5× the examples", q.quote({ plan: "standard", useCase: "qa", params: 9, languages: 2 }).examples === one.examples * 1.5);
const topics = q.quote({ plan: "standard", useCase: "persona", params: 4, topics: 15 });
check("15 planned topics need at least 80 examples each", topics.examples >= 15 * 80, topics.examples);
const sens = q.quote({ plan: "standard", useCase: "qa", params: 9, sensitive: true });
check("sensitive jobs pay for the strict judge", sens.qwen.cost > one.qwen.cost && sens.warnings.some((w) => /strict quality check/.test(w)));
check("very long context gets a warning before paying", q.quote({ plan: "standard", useCase: "qa", params: 9, minContext: 100000 }).warnings.some((w) => /100K tokens/.test(w)));
check("a plain job has no warnings", one.warnings.length === 0, one.warnings);
check("every shaped quote keeps the minimum profit",
  [five, sens, topics, q.quote({ plan: "extreme", useCase: "coding", params: 14, languages: 5, sensitive: true, topics: 15 })].every((x) => x.profit >= (x.plan === "extreme" ? 7 : 3) - 0.01));
check("examples are capped", q.examplesFor("extreme", "coding", { languages: 9, topics: 99 }) === 30000);

// The screen, the preview and the charge all derive the job from the same saved config.
const { load } = await import("./load_ts.mjs");
const plan = await load("plan");
const cfg = { purpose: "Tutor", selection: { spec: { useCase: "support", languages: ["English", "Hindi"], minContext: 8000 } },
  blueprint: { languages: ["English", "Hindi", "Tamil"], topics: [{}, {}, {}], sensitive: true } };
const j = plan.jobInputs(cfg);
check("job type comes from the plan, not the category chip", j.useCase === "support");
check("languages come from Qwen's plan when there is one", j.shape.languages === 3 && j.shape.topics === 3 && j.shape.sensitive === true);
check("without a Qwen plan, languages come from the selection", plan.jobInputs({ ...cfg, blueprint: undefined }).shape.languages === 2);
check("without any plan, the category decides and it's 1 language", JSON.stringify(plan.jobInputs({ purpose: "SQL assistant" })) === JSON.stringify({ useCase: "sql", shape: { languages: 1, topics: 0, sensitive: false, minContext: 8000 } }));
console.log(`\n${fails} failed`);
process.exit(fails ? 1 : 0);
