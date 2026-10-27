import { NextResponse } from "next/server";
import { kaggle, KaggleError, KernelStatus, splitRef } from "@/lib/server/kaggle";
import { readRepoJson } from "@/lib/server/hf";
import { supabaseServer, userCreds } from "@/lib/supabase/server";
import { getPod, removePod } from "@/lib/server/runpod";

export const runtime = "nodejs";

type Output = { log?: string };

// Kaggle says whether the job is queued, running or finished; the job's own progress.json in the
// state repo says what it's doing (stage, training step, test scores).
export async function POST(req: Request) {
  const { kernel, stateRepo } = await req.json();
  const account = await userCreds({ needKaggle: false }); // Pro runs have no Kaggle side
  if ("error" in account) return NextResponse.json({ error: account.error }, { status: account.status });
  const { kaggleUser, kaggleKey, hfToken } = account.creds;
  const creds = { username: kaggleUser, key: kaggleKey };

  // Pro runs on Zebrain's RunPod GPUs: report the pod in Kaggle's words, and remove it once the job has finished.
  if (typeof kernel === "string" && kernel.startsWith("runpod:")) {
    // The pod id comes from the browser: only act on it if this user's own run uses it (row-level security
    // limits the lookup to their rows), never on someone else's pod.
    const { data: mine } = await supabaseServer().from("runs").select("state_repo, deadline").eq("kernel", kernel).maybeSingle();
    if (!mine || mine.state_repo !== stateRepo) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    const podId = kernel.slice("runpod:".length);
    const progress = hfToken && stateRepo ? await readRepoJson<Record<string, unknown>>(stateRepo, "progress.json", hfToken) : null;
    const pastDeadline = mine.deadline && new Date(mine.deadline) < new Date();
    let status: KernelStatus | undefined;
    try {
      const pod = await getPod(podId);
      status = pod.desiredStatus === "RUNNING" ? "RUNNING" : pod.desiredStatus === "EXITED" ? "COMPLETE" : "QUEUED";
      if (progress?.stage === "done" || progress?.stage === "failed" || pastDeadline) await removePod(podId).catch(() => {});
      if (pastDeadline && progress?.stage !== "done") status = "ERROR";
    } catch {
      status = progress?.stage === "done" ? "COMPLETE" : progress?.stage === "failed" ? "ERROR" : undefined;
    }
    return NextResponse.json({ kaggle: { status }, progress, logTail: null });
  }

  const [status, progress] = await Promise.all([
    kaggle<{ status?: KernelStatus; failureMessage?: string }>(creds, "GetKernelSessionStatus", splitRef(kernel)).catch(
      (e) => ({ status: undefined, failureMessage: e instanceof KaggleError ? e.message : "Couldn't reach Kaggle." }),
    ),
    hfToken && stateRepo ? readRepoJson<Record<string, unknown>>(stateRepo, "progress.json", hfToken) : null,
  ]);

  // When Kaggle reports an error the job couldn't record itself (e.g. no GPU, out of quota), show the log's end.
  let logTail: string | null = null;
  if (status.status === "ERROR" && progress?.stage !== "failed") {
    try {
      const out = await kaggle<Output>(creds, "ListKernelSessionOutput", splitRef(kernel));
      logTail = out.log ? lastLines(out.log) : null;
    } catch {}
  }
  return NextResponse.json({ kaggle: status, progress, logTail });
}

// Kaggle logs are a JSON array of {stream_name, data}; fall back to raw text.
function lastLines(log: string) {
  try {
    const items = JSON.parse(log) as { data?: string }[];
    return items.map((i) => i.data ?? "").join("").split("\n").slice(-25).join("\n");
  } catch {
    return log.split("\n").slice(-25).join("\n");
  }
}
