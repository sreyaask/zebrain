import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { createHash, randomBytes } from "node:crypto";
import { BASE_MODELS } from "@/lib/models";
import { PLANS, paramsOf, USE_CASES } from "@/lib/quote";
import type { QwenJob, TrainConfig } from "@/lib/job";
import { services, supabaseAdmin } from "./admin";
import { createBudget, OUT_OF_SERVICE } from "./qwen";
import { serviceStatus } from "./status";
import { applyCredits, InsufficientCredits, toCredits } from "./wallet";
import { quote, examplesFor } from "@/lib/quote";
import { jobInputs } from "@/lib/plan";

export class PlanError extends Error {}

const TRIAL_TOKENS = 2_000_000;

// Decides what a training run may do under its plan, claims the free trial or the paid order, and gives the job
// a short-lived Qwen gateway token. Returns the config the job receives and where it runs.
export async function applyPlan(config: TrainConfig, userId: string, kaggleUser: string, origin: string, resuming: boolean, runId: string) {
  const plan = config.plan ?? "basic";
  const rules = PLANS[plan];
  const base = BASE_MODELS.find((m) => m.id === config.base_model);
  if (!base) throw new PlanError("Unknown base model.");
  if (paramsOf(base.size) > rules.maxParams)
    throw new PlanError(`${rules.name} trains models up to ${rules.maxParams}B parameters. Pick a smaller base model or another plan.`);

  if (plan === "basic") {
    if (!config.datasets?.length) throw new PlanError("Pick at least one dataset.");
    return { config: { ...config, plan, skip_tests: true, qwen: undefined }, where: "kaggle" as const, charged: 0 };
  }

  const on = services();
  if (on.qwen && !(await serviceStatus("qwen")).up) throw new PlanError(OUT_OF_SERVICE);
  const gateway = process.env.PUBLIC_URL || origin;
  if (/localhost|127\.0\.0\.1|\[::1\]/.test(gateway))
    throw new PlanError("Free trials and Pro need Zebrain online: set PUBLIC_URL to the deployed address, because Kaggle and RunPod can't reach localhost. Basic works now.");
  const db = () => supabaseAdmin();
  let budgetId: string;
  let tokens: number;
  let charged = 0;
  let maxHours: number | undefined;
  if (plan === "trial") {
    if (!on.trials || !on.qwen) throw new PlanError("The free trial isn't switched on yet. Use Basic for now; it's free too.");
    const { data: used } = await db().from("free_trials").select("budget_id").eq("user_id", userId).maybeSingle();
    if (used && !resuming) throw new PlanError("You've already used your free trial. Basic stays free, or choose Pro.");
    if (used) {
      budgetId = used.budget_id;
    } else {
      budgetId = await createBudget(userId, "trial", config.model_name, TRIAL_TOKENS);
      const { error } = await db().from("free_trials").insert({ user_id: userId, kaggle_user: kaggleUser, budget_id: budgetId });
      if (error) throw new PlanError(/kaggle/i.test(error.message) ? "This Kaggle account already used a free trial." : "You've already used your free trial.");
    }
    tokens = TRIAL_TOKENS;
  } else {
    if (!on.qwen) throw new PlanError("Pro isn't switched on yet (Qwen isn't connected). Basic works in the meantime.");
    if (!on.runpod) throw new PlanError("Pro training on Zebrain's GPUs isn't switched on yet.");
    // Priced again on the server from this exact model, job and documents, then paid from the wallet. The charge's
    // key is the run id, so a resumed run is never charged twice.
    const job = jobInputs(config);
    const q = quote({ plan, useCase: job.useCase, params: paramsOf(base.size), docTokens: await docTokensOf(userId, config.documents ?? []), ...job.shape });
    charged = toCredits(q.price);
    tokens = q.qwen.inputTokens + q.qwen.outputTokens;
    // Hard stop at twice the estimated GPU time plus 30 minutes: a hung run can't keep billing.
    maxHours = Math.round((2 * q.gpu.hours + 0.5) * 100) / 100;
    const key = `run:${runId}`;
    const { data: prior } = await db().from("credit_ledger").select("meta").eq("idempotency_key", key).maybeSingle();
    if (prior) {
      budgetId = prior.meta.budget_id;
      charged = 0; // already paid on the first attempt
    } else {
      budgetId = await createBudget(userId, plan, config.model_name, tokens);
      try {
        await applyCredits(userId, -toCredits(q.price), "charge", runId, key,
          { budget_id: budgetId, model: config.model_name, plan, base_model: config.base_model, quote: q });
      } catch (e) {
        await db().from("token_budgets").delete().eq("id", budgetId);
        if (e instanceof InsufficientCredits) throw new PlanError(e.message);
        throw e;
      }
    }
  }

  // The job's key to the gateway: only its hash is stored, and it expires after two days.
  const token = "zbr_" + randomBytes(24).toString("hex");
  await db().from("run_tokens").insert({
    token_hash: createHash("sha256").update(token).digest("hex"), budget_id: budgetId,
    expires_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
  });
  const { useCase, shape } = jobInputs(config);
  const uc = USE_CASES[useCase];
  // Kept examples to aim for: exactly what the price was based on, or for the trial what its tokens can pay for
  // (≈8.5 Qwen tokens per training token with one judge pass).
  const target = plan === "trial"
    ? Math.max(100, Math.min(examplesFor("standard", useCase, shape), Math.floor((tokens * 0.85) / (uc.L * 8.5))))
    : examplesFor(plan === "extreme" ? "extreme" : "standard", useCase, shape);
  const documents = await signedDocs(userId, config.documents ?? []);
  const qwen: QwenJob = {
    gateway: `${process.env.PUBLIC_URL || origin}/api/qwen`, token, use_case: useCase, examples: target,
    strict: plan === "extreme" || !!shape.sensitive, documents, search: documents.length === 0,
  };
  return { config: { ...config, plan, skip_tests: false, qwen, max_hours: maxHours }, where: plan === "trial" ? ("kaggle" as const) : ("runpod" as const), charged };
}

// Estimated tokens in the user's uploads (bytes ÷ 4, the same rule the price shown in the browser uses).
async function docTokensOf(userId: string, paths: string[]) {
  const mine = new Set(paths.filter((p) => p.startsWith(`${userId}/`)).map((p) => p.slice(userId.length + 1)));
  if (!mine.size) return 0;
  const { data } = await supabaseAdmin().storage.from("documents").list(userId, { limit: 1000 });
  return Math.round((data ?? []).filter((f) => mine.has(f.name)).reduce((n, f) => n + Number(f.metadata?.size ?? 0), 0) / 4);
}

// Two-day download links for the user's own uploads (paths must sit in their folder).
async function signedDocs(userId: string, paths: string[]) {
  const mine = paths.filter((p) => p.startsWith(`${userId}/`)).slice(0, 50);
  if (!mine.length) return [];
  const { data } = await supabaseAdmin().storage.from("documents").createSignedUrls(mine, 2 * 86400);
  return (data ?? []).filter((d) => d.signedUrl).map((d) => ({ name: (d.path ?? "").split("/").pop() || "document", url: d.signedUrl as string }));
}

// Fix runs (rewording corrections) and Testify (exam, grading, practice) get a small Zebrain AI budget of their own,
// paid by Zebrain. null when the AI isn't available, so fix runs fall back to templates.
const SMALL_AI = { fix: 300_000, improve: 1_000_000 };

export async function aiForRun(userId: string, mode: "fix" | "improve", modelName: string, origin: string): Promise<QwenJob | null> {
  const on = services();
  if (!on.qwen) return null;
  if (!(await serviceStatus("qwen")).up) {
    if (mode === "improve") throw new PlanError(OUT_OF_SERVICE);
    return null;
  }
  const gateway = process.env.PUBLIC_URL || origin;
  if (/localhost|127\.0\.0\.1|\[::1\]/.test(gateway)) {
    if (mode === "improve") throw new PlanError("Testify needs Zebrain online: set PUBLIC_URL to the deployed address.");
    return null;
  }
  const budgetId = await createBudget(userId, mode === "improve" ? "testify" : "fix", modelName, SMALL_AI[mode]);
  const token = "zbr_" + randomBytes(24).toString("hex");
  await supabaseAdmin().from("run_tokens").insert({
    token_hash: createHash("sha256").update(token).digest("hex"), budget_id: budgetId,
    expires_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
  });
  return { gateway: `${gateway}/api/qwen`, token, use_case: "qa", examples: 0, strict: false, documents: [], search: false };
}
