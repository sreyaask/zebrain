import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { JobConfig, kernelSlug, stateRepoFor } from "@/lib/job";
import { kaggle, KaggleError } from "@/lib/server/kaggle";
import { modelAccess, whoami } from "@/lib/server/hf";
import { buildJobScript } from "@/lib/server/script";
import { supabaseServer, userCreds } from "@/lib/supabase/server";
import { fromRow } from "@/lib/local";
import { aiForRun, applyPlan, PlanError } from "@/lib/server/plans";
import { MissingKeys, supabaseAdmin } from "@/lib/server/admin";
import { removePod, startTrainingPod } from "@/lib/server/runpod";
import { BASE_MODELS } from "@/lib/models";
import { paramsOf, PLANS, quote } from "@/lib/quote";
import { jobInputs } from "@/lib/plan";
import { applyCredits } from "@/lib/server/wallet";

export const runtime = "nodejs";

type SaveKernelResponse = { ref?: string; url?: string; versionNumber?: number; error?: string };

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Starts (or resumes) a run: checks the accounts and model access first, then pushes the job to
// the user's Kaggle account as a private GPU script. Passing the same runId again resumes from the
// last checkpoint instead of starting over.
export async function POST(req: Request) {
  const { config: asked, runId } = (await req.json()) as { config: JobConfig; runId?: string };
  let config = asked;
  const pro = asked?.mode === "train" && (asked.plan === "standard" || asked.plan === "extreme");
  const account = await userCreds({ needKaggle: !pro });
  if ("error" in account) return fail(account.error, account.status);
  const { kaggleUser, kaggleKey, hfToken } = account.creds;
  if (!config?.model_name || !config.base_model) return fail("The run is missing a model name or base model.");

  const me = await whoami(hfToken);
  if (!me) return fail("Hugging Face rejected your token. Reconnect with a token that has write access.");
  if (!me.canWrite) return fail("Your Hugging Face token is read-only. Make one with write access and reconnect.");

  if (config.mode === "train") {
    const access = await modelAccess(config.base_model, hfToken);
    if (access === "gated")
      return fail(`${config.base_model} is gated. Accept its terms on huggingface.co/${config.base_model} with the account ${me.name}, then try again.`);
    if (access === "missing") return fail(`Couldn't find ${config.base_model} on Hugging Face.`);
  }
  if (config.mode === "fix" || config.mode === "improve") {
    const size = paramsOf(BASE_MODELS.find((m) => m.id === config.base_model)?.size ?? "0");
    if (size > PLANS.basic.maxParams)
      return fail(`${config.mode === "fix" ? "Fixing" : "Testify for"} ${size}B models needs more memory than a free Kaggle GPU has. It's coming to Zebrain's GPUs; until then, Pro Extreme models can be retrained with a new Pro Extreme run.`);
  }
  if (config.mode === "fix" && !config.corrections?.length && !config.identity) {
    return fail("Add at least one correction.");
  }

  // Plans: Basic and the free trial run on the user's Kaggle; Pro runs on Zebrain's RunPod GPUs once paid.
  let where: "kaggle" | "runpod" = "kaggle";
  let charged = 0;
  const id = runId || randomUUID();
  if (config.mode === "train") {
    try {
      const planned = await applyPlan(config, account.userId, kaggleUser, new URL(req.url).origin, !!runId, id);
      config = planned.config;
      where = planned.where;
      charged = planned.charged;
    } catch (e) {
      if (e instanceof PlanError) return fail(e.message);
      if (e instanceof MissingKeys) return fail(e.message, 503);
      throw e;
    }
  }

  const slug = kernelSlug(config.model_name, config.mode);
  // The chat's API key: only the owner sees it, on Zebrain's chat page (read from their private state repo).
  const opensChat = config.mode === "serve" || ("chat_hours" in config && !!config.chat_hours);
  const apiKey = opensChat ? "zb_" + randomBytes(16).toString("hex") : undefined;
  // Fix and Testify runs get a small Zebrain AI budget through the gateway (rewording corrections, exams, grading).
  // The job only ever sees a short-lived run token, never an AI key.
  if (config.mode === "fix" || config.mode === "improve") {
    try {
      const qwen = await aiForRun(account.userId, config.mode, config.model_name, new URL(req.url).origin);
      if (config.mode === "improve" && !qwen) return fail("Testify isn't switched on yet: it needs Zebrain AI online.");
      config = { ...config, qwen } as JobConfig;
    } catch (e) {
      if (e instanceof PlanError) return fail(e.message);
      throw e;
    }
  }
  const script = buildJobScript({ ...config, run_id: id, hf_token: hfToken, api_key: apiKey });

  const saveRow = async (kernel: string, url: string, deadline: string | null = null) => {
    const row = {
      deadline,
      user_id: account.userId, run_id: id, kernel, kaggle_url: url,
      state_repo: stateRepoFor(me.name, config.model_name), model: `${me.name}/${config.model_name}`,
      mode: config.mode, config: asked, final_stage: null, started_at: new Date().toISOString(),
    };
    // Resuming reuses the run id, so the row is updated rather than duplicated. Run rows are written with the server
    // key: users may only mark their runs finished, never change where a run points or its deadline.
    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin() : supabaseServer();
    return db.from("runs").upsert(row, { onConflict: "user_id,run_id,kernel" }).select().single();
  };

  if (where === "runpod" && config.mode === "train") {
    const base = BASE_MODELS.find((m) => m.id === config.base_model)!;
    const plan = config.plan === "extreme" ? "extreme" : "standard";
    const job = jobInputs(config);
    const q = quote({ plan, useCase: job.useCase, params: paramsOf(base.size), ...job.shape }); // same GPU as priced
    try {
      const pod = await startTrainingPod({
        name: `zebrain-${config.model_name}`, script, gpuId: q.gpu.id, gpuCount: q.gpu.count, diskGb: Math.ceil(40 + 6 * q.params),
      });
      const hours = config.max_hours ?? 2 * q.gpu.hours + 0.5;
      const { data, error } = await saveRow(`runpod:${pod.id}`, `https://www.runpod.io/console/pods/${pod.id}`,
        new Date(Date.now() + hours * 3600_000).toISOString());
      if (error) {
        // Not recorded means nobody could see or stop it: stop the pod and return the credits.
        await removePod(pod.id).catch(() => {});
        if (charged) await applyCredits(account.userId, charged, "refund", id, `refund:${id}`, { reason: "run couldn't be saved" }).catch(() => {});
        return fail(`Training couldn't be recorded, so it was stopped and your credits returned: ${error.message}`, 500);
      }
      return NextResponse.json({ run: fromRow(data) });
    } catch (e) {
      // Nothing ran: give the credits back (once, keyed by the run).
      if (charged) await applyCredits(account.userId, charged, "refund", id, `refund:${id}`, { reason: "GPU didn't start" }).catch(() => {});
      return fail(`Couldn't start Zebrain's GPU, so your credits were returned: ${e instanceof Error ? e.message : "RunPod failed"}`, 502);
    }
  }

  try {
    const saved = await kaggle<SaveKernelResponse>({ username: kaggleUser, key: kaggleKey }, "SaveKernel", {
      slug: `${kaggleUser}/${slug}`,
      newTitle: slug,
      text: script,
      language: "python",
      kernelType: "script",
      isPrivate: true,
      enableGpu: true,
      enableInternet: true,
      machineShape: "NvidiaTeslaT4",
    });
    if (saved.error && config.mode === "train" && config.plan === "trial" && !runId) await releaseTrial(account.userId);
    if (saved.error) {
      if (/session count/i.test(saved.error)) {
        return fail("Kaggle runs at most 2 GPU sessions at once, and both are busy. Turn a Zebrain chat offline, stop a notebook you're running at kaggle.com/code (Edit → Stop session), or wait for one to finish, then try again.");
      }
      const phone = /phone|verif/i.test(saved.error);
      return fail(phone ? `Kaggle says: ${saved.error}. Verify your phone number in Kaggle settings so jobs can use a GPU and the internet.` : `Kaggle says: ${saved.error}`);
    }
    const { data, error } = await saveRow(
      saved.ref?.replace(/^\/+/, "").replace(/^code\//, "") || `${kaggleUser}/${slug}`,
      saved.url || `https://www.kaggle.com/code/${kaggleUser}/${slug}`,
    );
    if (error) return fail(`The run started on Kaggle, but saving it failed: ${error.message}`, 500);
    return NextResponse.json({ run: fromRow(data) });
  } catch (e) {
    if (config.mode === "train" && config.plan === "trial" && !runId) await releaseTrial(account.userId);
    return fail(e instanceof KaggleError ? `Kaggle: ${e.message}` : "Couldn't reach Kaggle.", 502);
  }
}

// Kaggle refused the job, so nothing ran: give the free trial back (and remove its unused token budget).
async function releaseTrial(userId: string) {
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("free_trials").select("budget_id").eq("user_id", userId).maybeSingle();
    await db.from("free_trials").delete().eq("user_id", userId);
    if (data?.budget_id) {
      await db.from("run_tokens").delete().eq("budget_id", data.budget_id);
      await db.from("token_budgets").delete().eq("id", data.budget_id).eq("data_used", 0);
    }
  } catch {}
}
