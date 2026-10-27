// Base-model selection from a description: hard constraints (languages, inputs, context, plan size) are never
// traded for price or speed; preferences rank what's left; impossible requests say why.
// Run: node tests/test_select.mjs
import { load } from "./load_ts.mjs";
const s = await load("select");
let fails = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : `  -> ${detail}`)); if (!ok) fails++; };

const indic = s.parseSpec("A friendly support assistant for our shop that chats in English, Hindi, Telugu and Tamil", "Customer support");
check("reads languages and job from plain English", indic.languages.join() === "English,Hindi,Telugu,Tamil" && indic.useCase === "support", JSON.stringify(indic));
let r = s.selectModel(indic, "basic");
check("Indic languages rule out models whose cards list other languages (Phi-4 mini, Granite)",
  !r.candidates.find((c) => c.id.includes("Phi-4")).eligible && !r.candidates.find((c) => c.id.includes("granite")).eligible);
check("picks a model whose card covers all four languages", r.pick && ["claimed", "listed"].includes(r.pick.languages.Telugu), JSON.stringify(r.pick));
check("says Telugu is a broad claim, not individually confirmed", /not individually confirmed/.test(r.explanation), r.explanation);

r = s.selectModel(s.parseSpec("Customer support bot in English and German", "Customer support"), "basic");
check("German: a model that explicitly lists it can win", r.pick && r.pick.languages.German !== "not listed", JSON.stringify(r.pick?.languages));

r = s.selectModel(s.parseSpec("Read photos of receipts and extract totals as JSON"), "standard");
check("image input: nothing eligible, explains why instead of weakening the requirement", r.pick === null && /image/.test(r.explanation), r.explanation);

r = s.selectModel(s.parseSpec("Answer questions about whole contracts, 100k tokens long", "Research Q&A"), "extreme");
check("100K context excludes 32K-context Qwen3 14B", !r.candidates.find((c) => c.id === "Qwen/Qwen3-14B").eligible && r.pick?.id !== "Qwen/Qwen3-14B");

const best = s.selectModel(s.parseSpec("The best, most accurate coding assistant", "Coding assistant"), "extreme");
const fast = s.selectModel(s.parseSpec("A fast, cheap coding helper", "Coding assistant"), "extreme");
check("'best' prefers a bigger model than 'fast'", best.pick.params > fast.pick.params, `${best.pick.id} vs ${fast.pick.id}`);
check("free plans never pick a model over 9B", s.selectModel(s.parseSpec("The best coding assistant"), "basic").pick.params <= 9);
check("Pro Extreme may pick 14B", best.pick.params <= 14);
check("every registry entry has a source and verified date", s.REGISTRY.every((e) => e.source.startsWith("https://huggingface.co/") && e.verified));
console.log(`\n${fails} failed`);
process.exit(fails ? 1 : 0);
