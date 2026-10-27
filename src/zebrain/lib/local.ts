// The signed-in user's account state and runs, stored in Supabase (row-level security: own rows only).
// Kaggle and Hugging Face keys are saved once on the Connect page and only ever read by Zebrain's server.

import type { JobConfig } from "./job";
import { supabase } from "./supabase/client";

export type Account = { connected: boolean; kaggleUser?: string; hfUser?: string };

export type Run = {
  runId: string;
  kernel: string; // kaggle user/slug
  kaggleUrl: string;
  stateRepo: string; // hf user/<model>-zebrain
  model: string; // hf user/<model>
  mode: JobConfig["mode"];
  config: JobConfig;
  startedAt: number;
  finalStage?: "done" | "failed";
};

type RunRow = {
  run_id: string; kernel: string; kaggle_url: string | null; state_repo: string; model: string | null;
  mode: JobConfig["mode"]; config: JobConfig; started_at: string; final_stage: "done" | "failed" | null;
};

export const fromRow = (r: RunRow): Run => ({
  runId: r.run_id, kernel: r.kernel, kaggleUrl: r.kaggle_url ?? "", stateRepo: r.state_repo, model: r.model ?? "",
  mode: r.mode, config: r.config, startedAt: new Date(r.started_at).getTime(), finalStage: r.final_stage ?? undefined,
});

// null when signed out. Asks the server, so saved keys never reach the browser.
export async function loadAccount(): Promise<Account | null> {
  const res = await fetch("/api/account", { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { account: Account | null }).account;
}

export async function loadRuns(): Promise<Run[]> {
  const { data } = await supabase().from("runs").select("*").order("started_at", { ascending: false }).limit(100);
  return (data as RunRow[] | null ?? []).map(fromRow);
}

export async function updateRun(runId: string, kernel: string, patch: { finalStage: "done" | "failed" }) {
  await supabase().from("runs").update({ final_stage: patch.finalStage }).eq("run_id", runId).eq("kernel", kernel);
}

// Start or resume a run through Zebrain's server, which uses the saved keys and records the run.
export async function startRun(config: JobConfig, runId?: string): Promise<Run> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config, runId }),
  });
  const data = await res.json().catch(() => ({ error: "Zebrain's server didn't answer." }));
  if (!res.ok) throw new Error(data.error || "Couldn't start the run.");
  return data.run as Run;
}

// POST helper for Zebrain's own API routes (the server adds the user's keys).
export async function api<T = Record<string, unknown>>(path: string, body: object = {}): Promise<T & { error?: string }> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => ({ error: "Zebrain's server didn't answer." }));
}

export const runHref = (r: Pick<Run, "kernel" | "runId">) => `/runs?k=${encodeURIComponent(r.kernel)}&r=${encodeURIComponent(r.runId)}`;
