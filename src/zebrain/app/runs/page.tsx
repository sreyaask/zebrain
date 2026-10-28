"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loadRuns, Run, runHref, startRun, updateRun } from "@/lib/local";
import { supabase } from "@/lib/supabase/client";
import { play } from "@/lib/sound";
import { Celebrate, EmptyState, ErrorNote, Fabs, Icon, Skeleton, type IconName } from "../ui";

type Round = { round: string; scores: Record<string, number | null>; passed: boolean; reasons: string[]; examples?: number };
type Progress = {
  stage: string;
  message?: string;
  events?: { t: number; msg: string }[];
  step?: number;
  total_steps?: number;
  loss?: number;
  round_name?: string;
  data_checks?: Record<string, number>;
  sources?: { dataset: string; rows: number; problem?: string }[];
  base_scores?: Record<string, number | null>;
  rounds?: Round[];
  error?: string;
  failed_stage?: string;
  chat?: { url: string; tag: string; until: number };
  result?: { repo?: string; tag?: string; space?: string | null; passed?: boolean; published?: boolean; note?: string };
};
type Status = { kaggle: { status?: string; failureMessage?: string }; progress: Progress | null; logTail: string | null };

const TRAIN_STAGES = [
  ["checks", "Check accounts, GPU and model access"],
  ["data", "Load and check the data"],
  ["baseline", "Test the untrained model"],
  ["training", "Train"],
  ["testing", "Test, and train again if needed"],
  ["publishing", "Publish the best version"],
] as const;
const IMPROVE_STAGES = [
  ["checks", "Check accounts and GPU"],
  ["baseline", "Zebrain AI grades the current version"],
  ["data", "Zebrain AI finds weak topics and writes practice"],
  ["training", "Train on the practice, keeping old skills"],
  ["testing", "Zebrain AI grades it again"],
  ["publishing", "Publish if it got better"],
] as const;
const SERVE_STAGES = [
  ["checks", "Check accounts and GPU"],
  ["loading", "Load the model on the GPU"],
  ["serving", "Chat and API open"],
] as const;
const FIX_STAGES = [
  ["checks", "Check accounts and GPU"],
  ["data", "Turn your corrections into examples"],
  ["baseline", "Test the current version"],
  ["training", "Continue training from it"],
  ["testing", "Test the fix and the old questions"],
  ["publishing", "Publish as a new version"],
] as const;

// Maps the job's stage names onto the steps shown here.
function stepIndex(p: Progress | null, kaggle?: string, mode?: string): number {
  if (!p) return kaggle === "RUNNING" ? 0 : -1;
  if (p.stage === "failed") return p.failed_stage ? stepIndex({ ...p, stage: p.failed_stage }, kaggle, mode) : 0;
  const s = p.stage;
  if (mode === "serve") return s === "loading" ? 1 : s === "serving" ? 2 : s === "done" ? 3 : 0;
  if (mode === "improve") {
    if (s === "setup" || s === "checks" || s === "starting" || s === "loading") return 0;
    if (s === "testing" && !p.rounds?.length && !p.step) return 1;
    if (s === "data") return 2;
    if (s === "training") return 3;
    if (s === "testing") return 4;
    if (s === "publishing") return 5;
    if (s === "done") return 6;
    return -1;
  }
  if (s === "serving") return 6;
  if (s === "setup" || s === "checks" || s === "starting") return 0;
  if (s === "data" || s === "loading") return 1;
  if (s === "testing" && !p.rounds?.length && !p.step) return 2;
  if (s === "training" || s === "retraining") return 3;
  if (s === "testing") return 4;
  if (s === "publishing") return 5;
  if (s === "done") return 6;
  return -1;
}

const KAGGLE_LABEL: Record<string, string> = {
  QUEUED: "Waiting for a Kaggle GPU", RUNNING: "Running on Kaggle", COMPLETE: "Finished on Kaggle", ERROR: "Stopped with an error on Kaggle",
  CANCEL_REQUESTED: "Cancelling", CANCEL_ACKNOWLEDGED: "Cancelled", NEW_SCRIPT: "Saved on Kaggle",
};

// A training run in four phases the user can follow at a glance; each maps onto the job's own stages above.
const PHASES: { label: string; icon: IconName; stages: number[] }[] = [
  { label: "Building dataset", icon: "database", stages: [0, 1] },
  { label: "Checking quality", icon: "shield", stages: [2] },
  { label: "Training", icon: "cpu", stages: [3, 4] },
  { label: "Publishing", icon: "rocket", stages: [5] },
];

const HELP = {
  title: "Runs",
  body: (
    <>
      <p>Each run trains, fixes or serves one model. This page checks on it every 20 seconds; you can close the tab and come back.</p>
      <p>If a run stops, open it and press “Start again”: it picks up from the last checkpoint.</p>
    </>
  ),
};

export default function RunsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Runs />
    </Suspense>
  );
}

function Runs() {
  const params = useSearchParams();
  const kernel = params.get("k");
  const runId = params.get("r");
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const load = useCallback(() => {
    setLoadErr("");
    loadRuns().then(setRuns).catch(() => setLoadErr("Couldn't load your runs. Check your connection."));
  }, []);
  useEffect(load, [load, kernel, runId]);
  const run = runs?.find((r) => r.kernel === kernel && r.runId === runId);
  const [oldRuns, setOldRuns] = useState<Run[]>([]);
  useEffect(() => {
    try {
      setOldRuns(JSON.parse(localStorage.getItem("zebrain.runs") || "[]"));
    } catch {}
  }, []);

  // Earlier versions of Zebrain kept runs in this browser; copy them into the account once.
  async function importOld() {
    const rows = oldRuns.map((r) => ({
      run_id: r.runId, kernel: r.kernel, kaggle_url: r.kaggleUrl, state_repo: r.stateRepo, model: r.model, mode: r.mode,
      config: r.config, final_stage: r.finalStage ?? null, started_at: new Date(r.startedAt).toISOString(),
    }));
    const { error } = await supabase().from("runs").upsert(rows, { onConflict: "user_id,run_id,kernel", ignoreDuplicates: true });
    if (!error) {
      try {
        localStorage.removeItem("zebrain.runs");
      } catch {}
      setOldRuns([]);
      setRuns(await loadRuns());
    }
  }

  if (runs === null) {
    return loadErr ? <Shell title="Runs"><ErrorNote message={loadErr} onRetry={load} /></Shell> : <ListSkeleton />;
  }
  if (kernel && runId) {
    return run ? <RunDetail run={run} /> : (
      <Shell title="Run not found">
        <EmptyState icon="search" title="This run isn't in your account" action={<Link className="btn" href="/runs">See all runs</Link>}>
          It may belong to another account, or the link is incomplete.
        </EmptyState>
      </Shell>
    );
  }
  return (
    <Shell title="Runs" lede="Your training, fix and chat runs. Each one runs on your Kaggle GPU.">
      {oldRuns.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-line p-4 text-sm">
          <p className="mr-auto">{oldRuns.length} run{oldRuns.length > 1 ? "s" : ""} from an earlier version are saved in this browser only.</p>
          <button className="btn" onClick={importOld}>Add them to my account</button>
        </div>
      )}
      {runs.length === 0 ? (
        <EmptyState icon="sparkle" title="No runs yet" action={<Link className="btn" href="/new"><Icon name="plus" className="h-4 w-4" /> Make your first model</Link>}>
          Describe what your model should do and Zebrain plans it, writes its data and trains it. Your runs show up here.
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {runs.map((r, i) => (
            <li key={r.runId + r.kernel} className="zb-bubble grid gap-1 rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-paper/30 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <span className={`hidden h-2.5 w-2.5 rounded-full sm:block ${r.finalStage === "done" ? "bg-good" : r.finalStage === "failed" ? "bg-bad" : "animate-pulse bg-accent"}`} aria-hidden="true" />
              <Link href={runHref(r)} className="link font-semibold">
                {r.config.model_name} <span className="font-normal text-mute">· {r.mode === "fix" ? "fix" : r.mode === "serve" ? "chat" : r.mode === "improve" ? "testify" : "training"}</span>
              </Link>
              <span className="text-sm text-mute">
                {new Date(r.startedAt).toLocaleString()} · {r.finalStage ? (r.finalStage === "done" ? "finished" : "stopped") : "in progress"}
                {r.mode === "train" && (
                  <>
                    {" "}· <Link className="link text-paper" href={`/fix?m=${encodeURIComponent(r.stateRepo)}`}>Fix answers</Link>
                    {" "}· <Link className="link text-accent" href={`/fix?m=${encodeURIComponent(r.stateRepo)}#testify`}>Testify</Link>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

type Checkpoint = { round: string; step: number; maxSteps: number | null; runId: string | null; rev: string; date: string };

// Every round-1 checkpoint this model ever saved, newest progress first, including ones a later attempt replaced.
function SavedCheckpoints({ run, canStart, starting, onPublish }: {
  run: Run; canStart: boolean; starting: boolean; onPublish: (c: Checkpoint) => void;
}) {
  const [list, setList] = useState<Checkpoint[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/runs/checkpoints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stateRepo: run.stateRepo }) })
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setList((d.checkpoints as Checkpoint[]).filter((c) => c.round === "round1"))))
      .catch(() => setErr("Couldn't load the saved checkpoints."));
  }, [run.stateRepo]);
  if (err) return <p className="mb-10 text-sm text-mute">{err}</p>;
  if (!list || list.length === 0) return null;
  return (
    <div className="mb-10 border-t border-line pt-4">
      <h2 className="mb-1 font-semibold">Saved training</h2>
      <p className="mb-3 max-w-[64ch] text-sm text-mute">
        Every checkpoint this model saved, even ones a later attempt replaced. Publishing one finishes that round from
        there, tests it once and publishes it, with no extra rounds.{!canStart && " Stop the current run first."}
      </p>
      <ul>
        {list.map((c, i) => {
          const complete = c.maxSteps !== null && c.step >= c.maxSteps;
          return (
            <li key={c.rev} className="grid gap-2 border-t border-line py-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <span className="font-medium">Step {c.step}{c.maxSteps ? ` of ${c.maxSteps}` : ""}</span>
                {complete && <span className="ml-2 text-sm text-accent">training finished</span>}
                {i === 0 && <span className="ml-2 text-sm text-mute">furthest</span>}
                <p className="text-sm text-mute">
                  Saved {new Date(c.date).toLocaleString()}{c.runId && c.runId !== run.runId ? " · from an earlier run of this model" : ""}
                </p>
              </div>
              <button className={i === 0 ? "btn" : "btn-ghost"} disabled={!canStart || starting} onClick={() => onPublish(c)}>
                {starting ? "Starting…" : "Publish from here"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Shell({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-32">
      <header className="pb-8 pt-14 md:pt-20">
        <h1 className="mb-3 break-words text-4xl font-medium tracking-tight md:text-5xl">{title}</h1>
        {lede && <p className="max-w-[60ch] text-lg text-mute">{lede}</p>}
      </header>
      {children}
      <Fabs help={HELP} />
    </main>
  );
}

function ListSkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20" aria-busy="true" aria-label="Loading runs">
      <div className="pb-8 pt-14 md:pt-20"><Skeleton className="mb-3 h-12 w-48" /><Skeleton className="h-5 w-80 max-w-full" /></div>
      <div className="grid gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
    </main>
  );
}

// The run at a glance: four animated phases and one progress bar, both from the job's real state.
function Pipeline({ phases, at, fraction, failed, done }: {
  phases: { label: string; icon: IconName }[]; at: number; fraction: number; failed: boolean; done: boolean;
}) {
  const pct = done ? 100 : Math.max(0, Math.min(99, Math.round(((Math.max(at, 0) + fraction) / phases.length) * 100)));
  return (
    <div className="mb-10 rounded-3xl border border-line bg-panel p-5 sm:p-6">
      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {phases.map((ph, i) => {
          const state = done || i < at ? "done" : i === at ? (failed ? "failed" : "now") : "todo";
          return (
            <li key={ph.label} className="flex items-center gap-3 sm:flex-col sm:items-start" aria-current={state === "now" ? "step" : undefined}>
              <span data-state={state} className={`zb-node grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${
                state === "done" ? "border-good bg-good text-black" : state === "now" ? "border-accent bg-accent text-white" : state === "failed" ? "border-bad bg-bad/15 text-bad" : "border-line text-mute"}`}>
                <Icon name={state === "done" ? "check" : state === "failed" ? "x" : ph.icon} />
              </span>
              <span>
                <span className={`block text-sm font-medium ${state === "todo" ? "text-mute" : ""}`}>{ph.label}</span>
                <span className="block text-xs text-mute">{state === "done" ? "Done" : state === "now" ? "In progress" : state === "failed" ? "Stopped here" : "Up next"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-6">
        <div className="mb-1.5 flex justify-between text-xs text-mute"><span>{done ? "Finished" : failed ? "Stopped" : at < 0 ? "Waiting for a GPU" : "Working"}</span><span className="tabular-nums">{pct}%</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Overall progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`zb-fill h-full rounded-full ${failed ? "bg-bad" : done ? "bg-good" : "zb-stripes bg-accent"}`} style={{ width: `${Math.max(pct, 3)}%` }} />
        </div>
      </div>
    </div>
  );
}

function RunDetail({ run }: { run: Run }) {
  const router = useRouter();
  const [st, setSt] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const [resuming, setResuming] = useState(false);
  const p = st?.progress ?? null;
  const finished = p?.stage === "done" || p?.stage === "failed" || st?.kaggle.status === "ERROR" || st?.kaggle.status === "CANCEL_ACKNOWLEDGED";

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/runs/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kernel: run.kernel, stateRepo: run.stateRepo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error === "Connect Kaggle and Hugging Face first." ? "Connect your accounts to see this run's progress." : data.error);
        return;
      }
      // progress.json belongs to the latest run of this model; ignore it if it's from an older run.
      if (data.progress && (data.progress as { run_id?: string }).run_id !== run.runId) data.progress = null;
      // A resumed run keeps its run id, so right after "Start again" the file still holds the previous attempt's
      // final stage until the new job writes its own. Ignore reports from a job that started before this attempt.
      const begun = (data.progress as { started_at?: number } | null)?.started_at;
      if (data.progress && begun && begun * 1000 < run.startedAt - 120_000) data.progress = null;
      setSt(data);
      setErr("");
      const stage = data.progress?.stage;
      if (stage === "done" || stage === "failed") updateRun(run.runId, run.kernel, { finalStage: stage });
    } catch {
      setErr("Couldn't reach Zebrain's server. Retrying.");
    }
  }, [run]);

  useEffect(() => {
    poll();
    if (finished) return;
    const t = setInterval(poll, 20000);
    return () => clearInterval(t);
  }, [poll, finished]);

  async function resume(publishNow = false, from?: { round: string; step: number; rev: string }) {
    setResuming(true);
    try {
      const config = publishNow && run.config.mode === "train" ? { ...run.config, publish_now: true, resume_from: from } : run.config;
      const r = await startRun(config, run.runId);
      setSt(null);
      router.replace(runHref(r));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't restart the run.");
    } finally {
      setResuming(false);
    }
  }

  const stages = run.mode === "fix" ? FIX_STAGES : run.mode === "serve" ? SERVE_STAGES : run.mode === "improve" ? IMPROVE_STAGES : TRAIN_STAGES;
  const at = stepIndex(p, st?.kaggle.status, run.mode);
  const doneAt = stages.length;
  const failed = p?.stage === "failed" || (["ERROR", "CANCEL_ACKNOWLEDGED"].includes(st?.kaggle.status ?? "") && p?.stage !== "done");
  const result = p?.result;
  const modelName = run.config.model_name;
  const done = p?.stage === "done" || p?.stage === "serving";

  // Train runs show four phases; other runs show their own steps as phases.
  const phases = run.mode === "train"
    ? PHASES
    : stages.map(([key, label]) => ({ label, icon: (key === "training" ? "cpu" : key === "publishing" ? "rocket" : key === "testing" || key === "baseline" ? "shield" : key === "data" ? "database" : key === "serving" ? "chat" : "bolt") as IconName }));
  const phaseAt = at < 0 ? -1 : at >= doneAt ? phases.length : run.mode === "train" ? PHASES.findIndex((ph) => ph.stages.includes(at)) : at;
  // Within the current phase: training's real step count, otherwise halfway.
  const fraction = p?.stage === "training" && p.total_steps ? ((p.step ?? 0) / p.total_steps) * (run.mode === "train" ? 0.8 : 1) : p?.stage === "testing" && run.mode === "train" ? 0.9 : 0.5;

  // Sounds and confetti follow what happens while the page is open, not what had already happened.
  const seen = useRef<{ phase: number; failed: boolean } | null>(null);
  const [party, setParty] = useState(false);
  const finishedWell = done && result?.published !== false && run.mode !== "serve";
  useEffect(() => {
    if (!st) return;
    const prev = seen.current;
    seen.current = { phase: phaseAt, failed };
    if (!prev) {
      // Opened right as it finished (from a notification, say): celebrate once per run.
      if (finishedWell && Date.now() - run.startedAt < 7 * 24 * 3600_000) {
        const key = `zebrain.celebrated.${run.runId}`;
        try {
          if (!localStorage.getItem(key)) { localStorage.setItem(key, "1"); setParty(true); play("success"); }
        } catch {}
      }
      return;
    }
    if (failed && !prev.failed) return play("error");
    if (phaseAt > prev.phase) {
      if (finishedWell) {
        try { localStorage.setItem(`zebrain.celebrated.${run.runId}`, "1"); } catch {}
        setParty(true);
        play("success");
      } else play("step");
    }
  }, [st, phaseAt, failed, finishedWell, run.runId, run.startedAt]);
  const onOurGpu = run.kernel.startsWith("runpod:");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  async function cancelRun() {
    setCancelling(true);
    const r = await fetch("/api/runs/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: run.runId, kernel: run.kernel }) });
    const d = await r.json().catch(() => ({}));
    setCancelling(false);
    setConfirmCancel(false);
    if (!r.ok) setErr(d.error || "Couldn't cancel the run.");
    else updateRun(run.runId, run.kernel, { finalStage: "failed" });
    poll();
  }

  return (
    <Shell title={modelName} lede={run.mode === "fix" ? "Fixing wrong answers on top of the latest version." : run.mode === "serve" ? "Opening a chat and API on your Kaggle GPU." : run.mode === "improve" ? "Zebrain AI is testing the model, finding what it gets wrong and training it on new practice." : "Training a new model."}>
      <div className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span>{st ? KAGGLE_LABEL[st.kaggle.status ?? ""] ?? "Checking Kaggle…" : "Checking…"}</span>
        <a className="link text-mute" href={run.kaggleUrl} target="_blank" rel="noreferrer">{onOurGpu ? "GPU" : "Kaggle notebook"}</a>
        {onOurGpu && !finished && !confirmCancel && <button className="link text-mute" onClick={() => setConfirmCancel(true)}>Cancel run</button>}
        <a className="link text-mute" href={`https://huggingface.co/${run.stateRepo}`} target="_blank" rel="noreferrer">Run files</a>
      </div>
      {confirmCancel && (
        <div role="alertdialog" aria-labelledby="cancel-h" className="mb-6 max-w-[64ch] rounded-xl border border-bad/60 p-4">
          <p id="cancel-h" className="font-medium">Cancel this run?</p>
          <p className="mt-1 text-sm text-mute">Training stops now and nothing is published. Credits aren&apos;t refunded once a run has started.</p>
          <div className="mt-3 flex gap-3">
            <button className="btn bg-bad text-ink hover:bg-bad/80" onClick={cancelRun} disabled={cancelling}>{cancelling ? "Cancelling…" : "Cancel run"}</button>
            <button className="btn-ghost" onClick={() => setConfirmCancel(false)} disabled={cancelling} autoFocus>Keep running</button>
          </div>
        </div>
      )}
      {err && (
        <div className="mb-6">
          {err.startsWith("Connect") ? (
            <ErrorNote message={err}><Link className="btn mt-3" href={`/connect?next=${encodeURIComponent(runHref(run))}`}>Connect accounts</Link></ErrorNote>
          ) : <ErrorNote message={err} onRetry={poll} />}
        </div>
      )}

      <Celebrate show={party} />
      {st === null && !err ? (
        <div className="mb-10 rounded-3xl border border-line bg-panel p-6" aria-busy="true" aria-label="Loading progress">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{phases.map((ph) => <div key={ph.label}><Skeleton className="mb-2 h-11 w-11 rounded-2xl" /><Skeleton className="h-4 w-24" /></div>)}</div>
          <Skeleton className="mt-6 h-2.5 w-full" />
        </div>
      ) : (
        <Pipeline phases={phases} at={phaseAt} fraction={fraction} failed={failed} done={done} />
      )}
      {party && result?.repo && (
        <div className="zb-bubble mb-10 flex flex-wrap items-center gap-4 rounded-3xl border border-good/50 bg-good/[0.08] p-5">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-good text-black"><Icon name="sparkle" className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-medium">Your model is live!</p>
            <p className="break-words text-sm text-mute">{result.repo} {result.tag} is on your Hugging Face account. Say hi to it.</p>
          </div>
          <Link className="btn" href={`/chat?m=${encodeURIComponent(run.stateRepo)}`}>Chat with it</Link>
        </div>
      )}

      <div className="grid gap-12 md:grid-cols-[1fr_20rem]">
        <section aria-label="Progress">
          <ol className="mb-10">
            {stages.map(([key, label], i) => {
              const state = failed && i === Math.max(at, 0) ? "failed" : i < at || at >= doneAt ? "done" : i === at ? "now" : "todo";
              return (
                <li key={key} className={`grid grid-cols-[1.5rem_1fr] gap-x-3 border-t border-line py-3 ${state === "todo" ? "text-mute" : ""}`}>
                  <span className={`font-mono text-sm ${state === "done" ? "text-good" : state === "failed" ? "text-bad" : state === "now" ? "text-accent" : ""}`}>{state === "done" ? "✓" : state === "failed" ? "✕" : i + 1}</span>
                  <div>
                    <span className={state === "now" ? "font-semibold" : ""}>{label}</span>
                    {state === "now" && key === "training" && p?.total_steps ? <TrainingBar p={p} /> : null}
                    {state === "now" && key !== "training" && p?.message ? <p className="mt-1 text-sm text-mute">{p.message}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>

          {failed && (
            <div className="mb-10 rounded-2xl border border-bad/50 bg-bad/[0.06] p-5">
              <h2 className="mb-2 font-semibold">The run stopped. Nothing&apos;s lost: it saved its progress.</h2>
              <p className="mb-3 max-w-[64ch] text-sm">{p?.error || st?.kaggle.failureMessage || "Kaggle stopped the job."}</p>
              {st?.logTail && <pre className="mb-4 max-h-64 overflow-auto rounded-md border border-line bg-panel p-3 font-mono text-xs text-mute">{st.logTail}</pre>}
              <div className="flex flex-wrap gap-3">
                <button className="btn" onClick={() => resume()} disabled={resuming}>{resuming ? "Starting…" : "Start again from the last checkpoint"}</button>
                {run.mode === "train" && (
                  <button className="btn-ghost" onClick={() => resume(true)} disabled={resuming}
                    title="Finishes the round it was on from the last checkpoint, tests it once and publishes it, without extra training rounds.">
                    Publish what it has
                  </button>
                )}
              </div>
            </div>
          )}

          {run.mode === "train" && (
            <SavedCheckpoints run={run} canStart={finished || failed} starting={resuming}
              onPublish={(c) => resume(true, { round: c.round, step: c.step, rev: c.rev })} />
          )}

          {p?.stage === "serving" && p.chat && (
            <div className="mb-10 border-t border-paper pt-4">
              <h2 className="mb-2 text-2xl font-medium">Chat is open with {p.chat.tag}</h2>
              <p className="mb-4 text-sm text-mute">
                Until {new Date(p.chat.until * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}, on your Kaggle GPU.
                {result?.note && run.mode !== "serve" ? ` ${result.note}` : ""}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link className="btn" href={`/chat?m=${encodeURIComponent(run.stateRepo)}`}>Chat and API</Link>
                <Link className="btn-ghost" href={`/fix?m=${encodeURIComponent(run.stateRepo)}`}>Fix a wrong answer</Link>
              </div>
            </div>
          )}

          {result && p?.stage === "done" && (
            <div className="mb-10 border-t border-paper pt-4">
              <h2 className="mb-2 text-2xl font-medium">
                {result.published === false ? "Nothing published" : `${result.repo} ${result.tag} is live`}
              </h2>
              {result.note && <p className="mb-4 max-w-[64ch] text-sm text-mute">{result.note}</p>}
              {result.published !== false && (
                <p className="mb-4 max-w-[64ch] text-sm text-mute">
                  For your own use, run it free on your Kaggle GPU: Zebrain starts it there with a chat on this site and an API,
                  for the hours you pick. Needs your Kaggle account connected.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {result.repo && <a className="btn-ghost" href={`https://huggingface.co/${result.repo}`} target="_blank" rel="noreferrer">Model page</a>}
                {result.published !== false && <Link className="btn-ghost" href={`/chat?m=${encodeURIComponent(run.stateRepo)}`}>Chat with it on your Kaggle</Link>}
                <Link className="btn" href={`/fix?m=${encodeURIComponent(run.stateRepo)}`}>Fix a wrong answer</Link>
              </div>
            </div>
          )}

          <Scores p={p} mode={run.mode} />
        </section>

        <aside aria-label="Details" className="text-sm">
          {p?.sources && (
            <div className="mb-8">
              <h2 className="mb-2 font-semibold">Data</h2>
              <ul className="space-y-1 text-mute">
                {p.sources.map((s) => (
                  <li key={s.dataset}><span className="break-all font-mono text-xs text-paper">{s.dataset}</span> · {s.rows ? `${s.rows} rows` : s.problem}</li>
                ))}
              </ul>
              {p.data_checks && Object.keys(p.data_checks).length > 0 && (
                <ul className="mt-3 space-y-1 text-mute">
                  {Object.entries(p.data_checks).map(([k, v]) => <li key={k}>{v} {k}</li>)}
                </ul>
              )}
            </div>
          )}
          {p?.events && (
            <div>
              <h2 className="mb-2 font-semibold">Log</h2>
              <ol className="space-y-1.5 text-mute">
                {[...p.events].reverse().slice(0, 14).map((e, i) => (
                  <li key={i}><span className="font-mono text-xs">{new Date(e.t * 1000).toLocaleTimeString()}</span> {e.msg}</li>
                ))}
              </ol>
            </div>
          )}
          {!p && !failed && <p className="text-mute">Kaggle usually starts a job within a few minutes. Installing libraries takes another two or three. This page updates by itself.</p>}
        </aside>
      </div>
    </Shell>
  );
}

function TrainingBar({ p }: { p: Progress }) {
  const pct = Math.min(100, Math.round(((p.step ?? 0) / (p.total_steps || 1)) * 100));
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full max-w-md rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="zb-fill h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 font-mono text-xs text-mute">
        {p.round_name} · step {p.step} of {p.total_steps}{p.loss != null ? ` · loss ${p.loss}` : ""}
      </p>
    </div>
  );
}

const SCORE_ROWS: [string, string][] = [
  ["corrections", "Your corrections"],
  ["task", "Test questions"],
  ["exam", "AI-written exam"],
  ["capability", "Describes its job"],
  ["identity", "Knows its name"],
  ["off_topic", "Declines off-topic questions"],
];

function Scores({ p, mode }: { p: Progress | null; mode: string }) {
  const fix = mode === "fix" || mode === "improve";
  if (!p?.base_scores) return null;
  const rounds = p.rounds ?? [];
  const rows = SCORE_ROWS.filter(([k]) => p.base_scores?.[k] != null || rounds.some((r) => r.scores[k] != null));
  const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v * 100)}%`);
  return (
    <section aria-label="Test scores">
      <h2 className="mb-1 font-semibold">Tester</h2>
      <p className="mb-4 max-w-[64ch] text-sm text-mute">
        {mode === "improve"
          ? "Zebrain AI grades every answer: held-back questions plus its exam. Each round practises the weak topics it found; the test questions are never trained on."
          : fix
          ? "The fix has to answer your corrections and still pass the questions the model passed before."
          : "Questions held back from training, plus identity and off-topic checks. If a round falls short, the model trains again from where it is."}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-[13px] text-mute">
              <th className="border-b border-line py-2 pr-4 font-normal" />
              <th className="border-b border-line py-2 pr-4 font-normal">{fix ? "Before" : "Untrained"}</th>
              {rounds.map((r, i) => <th key={r.round} className="border-b border-line py-2 pr-4 font-normal">Round {i + 1}{r.passed ? " ✓" : ""}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, label]) => (
              <tr key={k}>
                <th scope="row" className="border-b border-line py-2 pr-4 text-left font-normal text-mute">{label}</th>
                <td className="border-b border-line py-2 pr-4 font-mono tabular-nums">{pct(p.base_scores?.[k])}</td>
                {rounds.map((r) => <td key={r.round} className="border-b border-line py-2 pr-4 font-mono tabular-nums">{pct(r.scores[k])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rounds.filter((r) => !r.passed && r.reasons.length).slice(-1).map((r) => (
        <p key={r.round} className="mt-3 text-sm text-mute">Why it trained again: {r.reasons.join("; ")}.</p>
      ))}
    </section>
  );
}
