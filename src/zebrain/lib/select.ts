// Picks the base model from what the user describes. Requirements become hard constraints (languages, input
// types, context, plan size limit) and preferences become a weighted score; a model that fails a hard constraint
// is never chosen because it's cheaper. Every fact below is from the model's own Hugging Face card, read on the
// date given. Language support is recorded as the card states it; nothing here is a measured fluency score.

import { BASE_MODELS } from "./models";
import { PLANS, type Plan, paramsOf, useCaseFor, type UseCase } from "./quote";

export const REGISTRY_VERSION = "2026-10-27";

type LangSupport = { listed?: string[]; claim?: string }; // listed = explicit list on the card; claim = count only

type Entry = {
  id: string;
  params: number;
  context: number; // native context, tokens
  inputs: ("text" | "image" | "audio")[];
  languages: LangSupport;
  strengths: UseCase[];
  source: string;
  verified: string;
  notes?: string;
};

const CARD = (id: string) => `https://huggingface.co/${id}`;

export const REGISTRY: Entry[] = [
  { id: "Qwen/Qwen3.5-4B", params: 4, context: 262_144, inputs: ["text"], languages: { claim: "201 languages and dialects" },
    strengths: ["support", "coding", "qa", "persona", "extraction"], source: CARD("Qwen/Qwen3.5-4B"), verified: REGISTRY_VERSION },
  { id: "Qwen/Qwen3-4B-Instruct-2507", params: 4, context: 262_144, inputs: ["text"], languages: {},
    strengths: ["sql", "coding", "extraction", "qa"], source: CARD("Qwen/Qwen3-4B-Instruct-2507"), verified: REGISTRY_VERSION,
    notes: "The card doesn't state which languages it supports." },
  { id: "microsoft/Phi-4-mini-instruct", params: 3.8, context: 131_072, inputs: ["text"],
    languages: { listed: ["Arabic", "Chinese", "Czech", "Danish", "Dutch", "English", "Finnish", "French", "German", "Hebrew", "Hungarian", "Italian", "Japanese", "Korean", "Norwegian", "Polish", "Portuguese", "Russian", "Spanish", "Swedish", "Thai", "Turkish", "Ukrainian"] },
    strengths: ["qa"], source: CARD("microsoft/Phi-4-mini-instruct"), verified: REGISTRY_VERSION, notes: "Strong at maths and step-by-step reasoning." },
  { id: "google/gemma-4-E4B-it", params: 4, context: 131_072, inputs: ["text", "image", "audio"],
    languages: { claim: "35+ languages out of the box, pre-trained on 140+" },
    strengths: ["persona", "qa", "support"], source: CARD("google/gemma-4-E4B-it"), verified: REGISTRY_VERSION,
    notes: "Zebrain fine-tunes and serves its text side only." },
  { id: "ibm-granite/granite-4.2-8b", params: 8, context: 131_072, inputs: ["text"],
    languages: { listed: ["English", "German", "Spanish", "French", "Japanese", "Portuguese", "Arabic", "Czech", "Italian", "Korean", "Dutch", "Chinese"] },
    strengths: ["support", "extraction", "qa"], source: CARD("ibm-granite/granite-4.2-8b"), verified: REGISTRY_VERSION },
  { id: "Qwen/Qwen3.5-9B", params: 9, context: 262_144, inputs: ["text"], languages: { claim: "201 languages and dialects" },
    strengths: ["support", "coding", "sql", "qa", "persona", "extraction"], source: CARD("Qwen/Qwen3.5-9B"), verified: REGISTRY_VERSION },
  { id: "Qwen/Qwen3-14B", params: 14, context: 32_768, inputs: ["text"], languages: { claim: "100+ languages and dialects" },
    strengths: ["coding", "sql", "qa", "support"], source: CARD("Qwen/Qwen3-14B"), verified: REGISTRY_VERSION,
    notes: "32K native context (131K with YaRN scaling, not enabled by Zebrain)." },
];

export const LANGS = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Urdu", "Odia",
  "Arabic", "Chinese", "Czech", "Danish", "Dutch", "Finnish", "French", "German", "Hebrew", "Hungarian", "Indonesian", "Italian", "Japanese",
  "Korean", "Malay", "Norwegian", "Persian", "Polish", "Portuguese", "Russian", "Spanish", "Swahili", "Swedish", "Thai", "Turkish", "Ukrainian", "Vietnamese"];

export type Spec = {
  useCase: UseCase;
  languages: string[]; // mandatory
  inputs: ("text" | "image" | "audio")[];
  minContext: number;
  priority: "quality" | "balanced" | "speed";
};

// Reads the requirements out of a plain-English description. Deterministic, so the same words always give the
// same pick; the page shows what was understood so the user can correct it.
export function parseSpec(text: string, purpose = ""): Spec {
  const t = ` ${text.toLowerCase()} `;
  const languages = LANGS.filter((l) => t.includes(` ${l.toLowerCase()}`));
  const inputs: Spec["inputs"] = ["text"];
  if (/\b(image|images|photo|photos|picture|screenshot|scan)\b/.test(t)) inputs.push("image");
  if (/\b(voice|audio|speech|call recording|spoken)\b/.test(t)) inputs.push("audio");
  const k = t.match(/(\d{2,4})\s?k\s*(tokens|context)?/);
  const minContext = k ? Number(k[1]) * 1000 : /\b(long|large|entire|whole) (documents?|books?|contracts?|codebases?|files?)\b/.test(t) ? 64_000 : 8_000;
  const priority = /\b(best|highest|most accurate|top quality|premium)\b/.test(t) ? "quality"
    : /\b(fast|quick|real.?time|low latency|cheap|cheapest|lightweight)\b/.test(t) ? "speed" : "balanced";
  return { useCase: useCaseFor(`${purpose} ${text}`), languages: languages.length ? languages : ["English"], inputs, minContext, priority };
}

export type Verdict = "listed" | "claimed" | "not listed";

export function languageSupport(e: Entry, lang: string): Verdict {
  if (e.languages.listed) return e.languages.listed.includes(lang) ? "listed" : "not listed";
  if (lang === "English" && (e.languages.claim || !e.languages.listed)) return "listed"; // every model here is English-first
  return e.languages.claim ? "claimed" : "not listed";
}

export type Candidate = {
  id: string; name: string; params: number; score: number; eligible: boolean;
  failures: string[]; languages: Record<string, Verdict>; reasons: string[]; source: string; verified: string; notes?: string;
};

export function selectModel(spec: Spec, plan: Plan): { pick: Candidate | null; candidates: Candidate[]; explanation: string } {
  // Recommend within the chosen tier's limit, so both Pro prices exist for the pick (14B only when Extreme is chosen).
  const max = PLANS[plan].maxParams;
  const candidates = REGISTRY.map((e): Candidate => {
    const base = BASE_MODELS.find((m) => m.id === e.id);
    const languages = Object.fromEntries(spec.languages.map((l) => [l, languageSupport(e, l)])) as Record<string, Verdict>;
    const failures: string[] = [];
    const missing = spec.languages.filter((l) => languages[l] === "not listed");
    if (missing.length) failures.push(`doesn't list ${missing.join(", ")} on its model card`);
    const badInputs = spec.inputs.filter((i) => i !== "text");
    if (badInputs.length) failures.push(`Zebrain trains text only, and this job needs ${badInputs.join(" and ")} input`);
    if (e.context < spec.minContext) failures.push(`context is ${Math.round(e.context / 1000)}K tokens, the job needs ${Math.round(spec.minContext / 1000)}K`);
    if (e.params > max) failures.push(`${e.params}B is over this plan's ${max}B limit`);
    // Preferences: fit for the job, explicit language listing over a broad claim, then size against priority.
    const fit = e.strengths.includes(spec.useCase) ? 30 : 0;
    const langScore = spec.languages.reduce((n, l) => n + (languages[l] === "listed" ? 10 : languages[l] === "claimed" ? 6 : 0), 0) / spec.languages.length;
    const sizeScore = spec.priority === "quality" ? e.params * 3 : spec.priority === "speed" ? (14 - e.params) * 3 : 20 - Math.abs(e.params - 5) * 2;
    const reasons = [
      fit ? `good at ${spec.useCase === "qa" ? "answering from documents" : spec.useCase} jobs` : "",
      spec.languages.length > 1 || spec.languages[0] !== "English"
        ? spec.languages.map((l) => `${l}: ${languages[l] === "listed" ? "listed on its card" : languages[l] === "claimed" ? `covered by its card's broad claim (${e.languages.claim}), not individually confirmed` : "not listed"}`).join("; ")
        : "",
      `${e.params}B parameters, ${Math.round(e.context / 1000)}K context`,
    ].filter(Boolean);
    return {
      id: e.id, name: base?.name ?? e.id, params: e.params, eligible: failures.length === 0,
      score: Math.round(fit + langScore + sizeScore), failures, languages, reasons, source: e.source, verified: e.verified, notes: e.notes,
    };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
  const pick = candidates.find((c) => c.eligible) ?? null;
  const explanation = pick
    ? `${pick.name}: ${pick.reasons.join("; ")}.`
    : `No model meets every requirement. Closest: ${candidates.slice(0, 2).map((c) => `${c.name} (${c.failures.join("; ")})`).join(" · ")}.`;
  return { pick, candidates, explanation };
}

export const paramsOfModel = (id: string) => paramsOf(BASE_MODELS.find((m) => m.id === id)?.size ?? "0");
