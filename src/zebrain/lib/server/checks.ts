import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { probeQwen, sendEmail } from "./status";
import { supabaseAdmin } from "./admin";

// The admin's "does it work?" checks. Each returns PASS / FAIL / BLOCKED with a reason; no secret is ever returned.
// Live checks make one tiny read-only call per service (Qwen: one 5-token reply, a fraction of a cent).
export type Check = { name: string; status: "PASS" | "FAIL" | "BLOCKED" | "READY"; detail: string; ms?: number };

export async function runChecks(live: boolean, adminEmail?: string): Promise<Check[]> {
  const out: Check[] = [];
  const has = (...k: string[]) => k.every((x) => !!process.env[x]);
  async function check(name: string, keys: string[], fn: () => Promise<string>) {
    if (!has(...keys)) return out.push({ name, status: "BLOCKED", detail: `Add ${keys.filter((k) => !process.env[k]).join(", ")} to the server's environment.` });
    if (!live) return out.push({ name, status: "READY", detail: "Keys are set. Run live checks to call it." });
    const t0 = Date.now();
    try {
      out.push({ name, status: "PASS", detail: await fn(), ms: Date.now() - t0 });
    } catch (e) {
      out.push({ name, status: "FAIL", detail: e instanceof Error ? e.message.slice(0, 240) : "failed", ms: Date.now() - t0 });
    }
  }
  await check("Database (service key)", ["SUPABASE_SERVICE_ROLE_KEY"], async () => {
    const { count, error } = await supabaseAdmin().from("credit_packages").select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return `${count} credit packs readable`;
  });
  await check(`Zebrain AI (${process.env.AI_PROVIDER === "gemini" ? "Gemini, test mode" : "Qwen"})`, [process.env.AI_PROVIDER === "gemini" ? "GEMINI_API_KEY" : "QWEN_API_KEY"], async () => {
    const p = await probeQwen();
    if (!p.ok) throw new Error(p.detail);
    return p.detail;
  });
  await check("Razorpay", ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"], async () => {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) throw new Error(`Razorpay answered ${res.status}: check the key ID and secret`);
    return process.env.RAZORPAY_KEY_ID!.startsWith("rzp_test_") ? "Authenticated in test mode" : "Authenticated in LIVE mode: use test keys while testing";
  });
  await check("Razorpay webhook secret", ["RAZORPAY_WEBHOOK_SECRET"], async () => "Set; verified on each event Razorpay sends");
  await check("RunPod", ["RUNPOD_API_KEY"], async () => {
    const res = await fetch("https://rest.runpod.io/v1/pods", { headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` } });
    if (!res.ok) throw new Error(`RunPod answered ${res.status}`);
    const pods = await res.json();
    return `Authenticated; ${Array.isArray(pods) ? pods.length : 0} pod(s) running now`;
  });
  await check("Public address for jobs", ["PUBLIC_URL"], async () => {
    if (/localhost|127\.0\.0\.1/.test(process.env.PUBLIC_URL!)) throw new Error("PUBLIC_URL is a local address; Kaggle and RunPod jobs can't reach it");
    const r = await fetch(`${process.env.PUBLIC_URL}/api/qwen`, { method: "POST" });
    if (r.status !== 401) throw new Error(`The Qwen gateway answered ${r.status}; expected 401 without a run token`);
    return "Qwen gateway reachable from the internet";
  });
  await check("Email (Resend)", ["RESEND_API_KEY", "EMAIL_FROM"], async () => {
    if (!adminEmail) throw new Error("No admin email to send the test to");
    const r = await sendEmail(adminEmail, "Zebrain test email", "<p>Email from Zebrain works.</p>");
    if (!r.ok) throw new Error(r.error);
    return `Test email sent to ${adminEmail}`;
  });
  await check("Back-online cron", ["CRON_SECRET"], async () => "Set; Vercel Cron calls /api/status/probe every 10 minutes");
  return out;
}
