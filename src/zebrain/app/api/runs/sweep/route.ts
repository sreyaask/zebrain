import { NextResponse } from "next/server";
import { adminUser } from "@/lib/server/adminauth";
import { MissingKeys, supabaseAdmin } from "@/lib/server/admin";
import { removePod } from "@/lib/server/runpod";

export const runtime = "nodejs";

// Stops every Zebrain GPU pod whose run is past its deadline, even if nobody opens the run page. Called by Vercel
// Cron (Authorization: Bearer CRON_SECRET) every 10 minutes, or by an admin.
export async function GET(req: Request) {
  const cron = process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!cron && !(await adminUser())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  try {
    const db = supabaseAdmin();
    const { data: late } = await db.from("runs").select("id, kernel, run_id, model")
      .like("kernel", "runpod:%").is("final_stage", null).lt("deadline", new Date().toISOString()).limit(100);
    const stopped: string[] = [];
    for (const r of late ?? []) {
      const pod = r.kernel.slice("runpod:".length);
      await removePod(pod).catch(() => {}); // already gone is fine
      await db.from("runs").update({ final_stage: "failed" }).eq("id", r.id);
      await db.from("admin_alerts").insert({ kind: "run_deadline", message: `Stopped ${r.model} (run ${r.run_id}): it passed its GPU time limit. Check why it ran long.` });
      stopped.push(r.model);
    }
    return NextResponse.json({ stopped });
  } catch (e) {
    if (e instanceof MissingKeys) return NextResponse.json({ error: e.message }, { status: 503 });
    throw e;
  }
}
export const POST = GET;
