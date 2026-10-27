// Checks Qwen's model plan before anything uses it: unknown values are dropped or clamped, never trusted as-is.
// Pure (no server code), so it's shared by the planner and its tests.
import { LANGS, type Spec } from "./select";
import { USE_CASES, useCaseFor, type JobShape, type UseCase } from "./quote";

const clean = (s: unknown, max = 300) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export type Blueprint = {
  source: "qwen" | "rules";
  version: string;
  summary: string;
  spec: Spec;
  topics: { topic: string; cover: string }[];
  refuse: string[];
  sensitive: boolean;
  datasetNotes: string;
  questions: string[];
};

// Turns Qwen's JSON into a safe plan: unknown values are dropped or clamped, never trusted as-is.
export function validatePlan(raw: unknown, fallback: Spec): Omit<Blueprint, "source" | "version"> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const useCase = (Object.keys(USE_CASES) as UseCase[]).includes(r.use_case as UseCase) ? (r.use_case as UseCase) : fallback.useCase;
  const langs = (Array.isArray(r.languages) ? r.languages : [])
    .map((l) => LANGS.find((x) => x.toLowerCase() === String(l).trim().toLowerCase()))
    .filter((l): l is string => !!l);
  const inputs = ["text", ...(Array.isArray(r.inputs) ? r.inputs : []).filter((i) => i === "image" || i === "audio")] as Spec["inputs"];
  const ctx = Math.round(Number(r.min_context_tokens) || fallback.minContext);
  const priority = (["quality", "balanced", "speed"] as const).includes(r.priority as Spec["priority"]) ? (r.priority as Spec["priority"]) : fallback.priority;
  const topics = (Array.isArray(r.topics) ? r.topics : [])
    .map((t) => (t && typeof t === "object" ? { topic: clean((t as Record<string, unknown>).topic, 80), cover: clean((t as Record<string, unknown>).cover, 200) } : null))
    .filter((t): t is { topic: string; cover: string } => !!t?.topic).slice(0, 15);
  return {
    summary: clean(r.summary, 400),
    spec: {
      useCase,
      languages: [...new Set(langs.length ? langs : fallback.languages)],
      inputs: [...new Set(inputs)],
      minContext: Math.min(1_000_000, Math.max(4_000, ctx)),
      priority,
    },
    topics,
    refuse: (Array.isArray(r.refuse) ? r.refuse : []).map((x) => clean(x, 160)).filter(Boolean).slice(0, 8),
    sensitive: r.sensitive === true,
    datasetNotes: clean(r.dataset_notes, 600),
    questions: (Array.isArray(r.questions) ? r.questions : []).map((x) => clean(x, 200)).filter(Boolean).slice(0, 4),
  };
}


// The job's shape from a saved plan: the single source for dataset size and price, in the browser and on the server.
export function shapeOf(bp?: { languages?: string[]; topics?: unknown[]; sensitive?: boolean } | null, minContext?: number): JobShape {
  return {
    languages: Math.max(1, bp?.languages?.length ?? 1),
    topics: Array.isArray(bp?.topics) ? bp!.topics.length : 0,
    sensitive: bp?.sensitive === true,
    minContext: minContext ?? 8000,
  };
}

// The job type and shape for a run's saved config (plan + selection), so the server charges exactly what the screen showed.
export function jobInputs(cfg: { purpose: string; blueprint?: { languages?: string[]; topics?: unknown[]; sensitive?: boolean };
  selection?: { spec?: unknown } }): { useCase: UseCase; shape: JobShape } {
  const spec = (cfg.selection?.spec ?? null) as Partial<Spec> | null;
  const useCase = spec?.useCase && spec.useCase in USE_CASES ? spec.useCase : useCaseFor(cfg.purpose);
  const languages = cfg.blueprint?.languages ?? (Array.isArray(spec?.languages) ? spec!.languages : undefined);
  return { useCase, shape: shapeOf({ ...cfg.blueprint, languages }, typeof spec?.minContext === "number" ? spec.minContext : undefined) };
}
