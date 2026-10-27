import { NextResponse } from "next/server";
import { adminUser } from "@/lib/server/adminauth";
import { qwenSpendToday } from "@/lib/server/qwen";
import { markUp, probeQwen, serviceStatus } from "@/lib/server/status";

export const runtime = "nodejs";

// Checks whether a down service is back. Called every 10 minutes by Vercel Cron (Authorization: Bearer CRON_SECRET)
// or by an admin's button. Down for the daily cap: back once today's spend is under the cap again (new day or the cap
// was raised). Down for an Alibaba error: back once a tiny real request succeeds.
export async function GET(req: Request) {
  const cron = process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const admin = cron ? null : await adminUser();
  if (!cron && !admin) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const st = await serviceStatus("qwen");
  if (st.up) return NextResponse.json({ up: true, note: "Qwen is up; nothing to do." });
  if (String(st.reason || "").startsWith("Daily Qwen cap")) {
    const { spent, cap } = await qwenSpendToday();
    if (cap && spent >= cap) return NextResponse.json({ up: false, note: `Still over the daily cap ($${spent.toFixed(2)} of $${cap}).` });
  } else {
    const p = await probeQwen();
    if (!p.ok) return NextResponse.json({ up: false, note: p.detail });
  }
  const emails = await markUp("qwen", admin?.email ?? "cron");
  return NextResponse.json({ up: true, note: "Qwen is back; waitlist notified.", emails });
}
export const POST = GET;
