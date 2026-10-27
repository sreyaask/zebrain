import { NextResponse } from "next/server";
import { SEARCH_SYSTEM, PICK_SYSTEM, DATASET_PICKER_VERSION } from "@/lib/ai/prompts";
import { DatasetHit, isOpenLicense, searchDatasets } from "@/lib/hf";
import { MissingKeys, services } from "@/lib/server/admin";
import { AppBudgetReached, qwenPlatform } from "@/lib/server/qwen";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Job = { description: string; purpose: string };
type Pick = { id: string; reason: string };

const ROWS = "https://datasets-server.huggingface.co";



// Zebrain AI picks datasets for a Basic run: it suggests searches, Zebrain looks at real rows from the candidates,
// and the AI picks the ones that fit. Basic runs aren't tested, so no exam is written here.
export async function POST(req: Request) {
  const { job } = (await req.json()) as { job: Job };
  if (!job?.description?.trim()) return NextResponse.json({ error: "Describe the job first." }, { status: 400 });
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (rateLimited(`plan:${user.id}`, 10, 3600_000)) return NextResponse.json({ error: "Too many requests this hour. Try again later." }, { status: 429 });
  if (!services().qwen) return NextResponse.json({ error: "AI dataset picking isn't switched on yet. Search below or pick popular datasets." }, { status: 503 });

  const ask = async <T,>(system: string, user_: string, max = 1200) => {
    const out = await qwenPlatform(user.id, "pick_datasets", DATASET_PICKER_VERSION,
      [{ role: "system", content: system }, { role: "user", content: user_ }], { maxTokens: max, json: true, temperature: 0.2 });
    try {
      return JSON.parse(out.text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
    } catch {
      return null;
    }
  };
  const fence = (s: string) => s.replace(/<\/?(request|material)>/gi, "");

  try {
    const desc = `Category: ${fence(job.purpose ?? "").slice(0, 80)}\n<request>\n${fence(job.description).slice(0, 3000)}\n</request>`;
    const plan = await ask<{ searches?: unknown }>(SEARCH_SYSTEM, desc, 300);
    const searches = (Array.isArray(plan?.searches) ? plan!.searches : []).filter((x): x is string => typeof x === "string" && x.length < 60).slice(0, 5);
    const candidates = await findCandidates(searches.length ? searches : [job.purpose]);
    if (!candidates.length) return NextResponse.json({ error: "No open-licensed datasets matched. Try describing the job differently, or search below." }, { status: 404 });

    const samples = await Promise.all(candidates.map((c) => sample(c)));
    const listing = samples.map((s) => `### ${s.id} (${s.downloads} downloads, license ${s.license ?? "unknown"})\ncolumns: ${s.columns.join(", ") || "unknown"}\nrows: ${s.rows || "could not load sample rows"}`).join("\n\n");
    const choice = await ask<{ picks?: unknown; rejected?: unknown }>(PICK_SYSTEM, `${desc}\n\n<material>\n${fence(listing).slice(0, 60000)}\n</material>`);
    const known = new Set(candidates.map((c) => c.id));
    const valid = (x: unknown): x is Pick => !!x && typeof x === "object" && known.has((x as Pick).id) && typeof (x as Pick).reason === "string";
    const picks = (Array.isArray(choice?.picks) ? choice!.picks : []).filter(valid).slice(0, 3);
    if (!picks.length) return NextResponse.json({ error: "None of the datasets found fit this job well. Try searching yourself." }, { status: 404 });
    const rejected = (Array.isArray(choice?.rejected) ? choice!.rejected : []).filter(valid);
    return NextResponse.json({ datasets: picks, rejected });
  } catch (e) {
    if (e instanceof AppBudgetReached || e instanceof MissingKeys) return NextResponse.json({ error: e.message }, { status: 503 });
    return NextResponse.json({ error: "Dataset picking failed. Search below, or try again." }, { status: 502 });
  }
}

async function findCandidates(searches: string[]) {
  const seen = new Map<string, DatasetHit>();
  const results = await Promise.all(searches.slice(0, 5).map((q) => searchDatasets(q, 12).catch(() => [])));
  for (const hit of results.flat()) if (isOpenLicense(hit.license) && !seen.has(hit.id)) seen.set(hit.id, hit);
  return [...seen.values()].sort((a, b) => b.downloads - a.downloads).slice(0, 8);
}

async function sample(c: DatasetHit) {
  const base = { id: c.id, downloads: c.downloads, license: c.license, columns: [] as string[], rows: "" };
  try {
    const splits = await fetchJSON(`${ROWS}/splits?dataset=${encodeURIComponent(c.id)}`);
    const s = splits.splits?.find((x: { split: string }) => x.split === "train") ?? splits.splits?.[0];
    if (!s) return base;
    const first = await fetchJSON(`${ROWS}/first-rows?dataset=${encodeURIComponent(c.id)}&config=${encodeURIComponent(s.config)}&split=${encodeURIComponent(s.split)}`);
    const clip = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 280);
    return {
      ...base,
      columns: (first.features ?? []).map((f: { name: string }) => f.name),
      rows: (first.rows ?? []).slice(0, 2).map((r: { row: Record<string, unknown> }) => JSON.stringify(Object.fromEntries(Object.entries(r.row).map(([k, v]) => [k, clip(v)])))).join("\n"),
    };
  } catch {
    return base;
  }
}

async function fetchJSON(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}
