import { NextResponse } from "next/server";
import { checkRows, type DatasetCheck } from "@/lib/datasetcheck";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabaseServer, userCreds } from "@/lib/supabase/server";

export const runtime = "nodejs";
const ROWS = "https://datasets-server.huggingface.co";

// Reads the first rows of each chosen dataset through Hugging Face's viewer and runs the job's own row reader on
// them, so a dataset with no usable columns is caught before any GPU starts. Each lookup is time-limited.
export async function POST(req: Request) {
  const { ids } = await req.json().catch(() => ({ ids: [] }));
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (rateLimited(`dscheck:${user.id}`, 60, 3600_000)) return NextResponse.json({ error: "Too many checks. Try again later." }, { status: 429 });
  const account = await userCreds({ needKaggle: false });
  const headers: Record<string, string> = "creds" in account ? { Authorization: `Bearer ${account.creds.hfToken}` } : {};
  const list = (Array.isArray(ids) ? ids : []).filter((x) => /^[\w.-]+\/[\w.-]+$/.test(String(x))).slice(0, 10) as string[];
  const results: (DatasetCheck | { id: string; ok: null; problem: string })[] = await Promise.all(list.map(async (id) => {
    try {
      const get = (url: string) => fetch(url, { headers, signal: AbortSignal.timeout(20_000), cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
      const splits = await get(`${ROWS}/splits?dataset=${encodeURIComponent(id)}`);
      const s = (splits.splits ?? []).find((x: { split: string }) => x.split === "train") ?? splits.splits?.[0];
      if (!s) return checkRows(id, []);
      const page = await get(`${ROWS}/first-rows?dataset=${encodeURIComponent(id)}&config=${encodeURIComponent(s.config)}&split=${encodeURIComponent(s.split)}`);
      return checkRows(id, (page.rows ?? []).map((r: { row: Record<string, unknown> }) => r.row));
    } catch {
      // The viewer is off for some datasets: say we couldn't check, so the job's own check (with time limits) decides.
      return { id, ok: null, problem: "Couldn't preview this dataset; it will be checked when training starts." };
    }
  }));
  return NextResponse.json({ results });
}
