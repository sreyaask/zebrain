import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { supabaseAdmin } from "./admin";
import { aiConfigured, callAI, providerKeyName } from "@/lib/ai/provider";

// Out-of-service handling. When Qwen stops (Alibaba's monthly budget stop, unpaid bill, Zebrain's daily cap) the
// service is marked down, new trial and Pro runs are refused with a clear message, and people can leave an email.
// A probe (cron every 10 minutes, or the admin's button) checks again; when Qwen answers, the service is marked up
// and everyone on the waitlist gets one "we're back" email.

export type ServiceName = "qwen";

export async function serviceStatus(service: ServiceName = "qwen") {
  const { data } = await supabaseAdmin().from("service_status").select("*").eq("service", service).maybeSingle();
  return data ?? { service, up: true, reason: null, since: null, checked_at: null };
}

export async function markDown(service: ServiceName, reason: string) {
  const db = supabaseAdmin();
  const { data: cur } = await db.from("service_status").select("up").eq("service", service).maybeSingle();
  if (cur && !cur.up) return; // already down: keep the first reason and time
  await db.from("service_status").upsert({ service, up: false, reason: reason.slice(0, 300), since: new Date().toISOString(), checked_at: new Date().toISOString() });
  await db.from("admin_alerts").insert({ kind: `${service}_down`, message: `${service} marked out of service: ${reason.slice(0, 300)}` });
}

// Back up: record it and email everyone waiting. Returns how many were emailed and why any weren't.
export async function markUp(service: ServiceName, by = "probe") {
  const db = supabaseAdmin();
  await db.from("service_status").upsert({ service, up: true, reason: null, since: new Date().toISOString(), checked_at: new Date().toISOString() });
  await db.from("audit_log").insert({ actor: by, action: "service_up", target: service, meta: {} });
  return notifyWaitlist(service);
}

export async function notifyWaitlist(service: ServiceName) {
  const db = supabaseAdmin();
  const { data: waiting } = await db.from("service_waitlist").select("id, email").eq("service", service).is("notified_at", null).limit(500);
  let sent = 0;
  const errors: string[] = [];
  const site = process.env.PUBLIC_URL || "https://zebrain.app";
  for (const w of waiting ?? []) {
    const result = await sendEmail(w.email, "Zebrain is back: you can make your model now",
      `<p>Hi,</p><p>Zebrain is back in service. You can sign in and make your model now:</p>
       <p><a href="${site}/new">${site}/new</a></p><p>Thanks for waiting.<br>Zebrain</p>`);
    if (result.ok) {
      sent++;
      await db.from("service_waitlist").update({ notified_at: new Date().toISOString(), notify_error: null }).eq("id", w.id);
    } else {
      errors.push(result.error);
      await db.from("service_waitlist").update({ notify_error: result.error.slice(0, 200) }).eq("id", w.id);
    }
  }
  return { waiting: waiting?.length ?? 0, sent, errors: [...new Set(errors)] };
}

// Email through Resend (resend.com). Without RESEND_API_KEY nothing is sent and the waitlist keeps the address.
export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { ok: false, error: "Email isn't set up (RESEND_API_KEY and EMAIL_FROM)." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html }),
    });
    if (!res.ok) return { ok: false, error: `Resend answered ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach Resend." };
  }
}

// One tiny real request to the AI provider (5 output tokens, a fraction of a cent) that bypasses budgets: is the
// provider serving us?
export async function probeQwen(): Promise<{ ok: boolean; detail: string }> {
  if (!aiConfigured()) return { ok: false, detail: `${providerKeyName()} isn't set.` };
  try {
    await callAI([{ role: "user", content: "Reply ok." }], { maxTokens: 5 }, { prompt: 0, completion: 0 });
    await supabaseAdmin().from("service_status").update({ checked_at: new Date().toISOString() }).eq("service", "qwen");
    return { ok: true, detail: "Zebrain AI answered." };
  } catch (e) {
    return { ok: false, detail: `Zebrain AI didn't answer: ${e instanceof Error ? e.message.slice(0, 160) : "unknown error"}` };
  }
}
