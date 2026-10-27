import { NextResponse } from "next/server";
import { MissingKeys, services, supabaseAdmin } from "@/lib/server/admin";
import { adminUser } from "@/lib/server/adminauth";
import { applyCredits } from "@/lib/server/wallet";
import { REGISTRY_VERSION } from "@/lib/select";
import { PRICING_VERSION } from "@/lib/server/wallet";
import { runChecks } from "@/lib/server/checks";
import { markDown, markUp, notifyWaitlist, probeQwen } from "@/lib/server/status";

export const runtime = "nodejs";
const PRICE_IN = Number(process.env.QWEN_PRICE_IN || 0.03) / 1e6;
const PRICE_OUT = Number(process.env.QWEN_PRICE_OUT || 0.13) / 1e6;

// Everything on the admin page comes from here, read with the service key after checking the caller is an admin.
export async function GET() {
  if (!(await adminUser())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    const db = supabaseAdmin();
    const [users, runs, ledger, wallets, tokens, budgets, orders, alerts, limits, gaps, audit, status, waitlist] = await Promise.all([
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from("runs").select("user_id, mode, final_stage, started_at"),
      db.from("credit_ledger").select("user_id, delta, kind"),
      db.from("credit_wallets").select("user_id, balance"),
      db.from("token_ledger").select("budget_id, prompt_tokens, completion_tokens, searched, created_at"),
      db.from("token_budgets").select("id, user_id, model_name, plan"),
      db.from("orders").select("kind, status, amount_cents, tax_cents, currency, paid_at").eq("status", "paid"),
      db.from("admin_alerts").select("*").is("resolved_at", null).order("created_at", { ascending: false }).limit(50),
      db.from("app_limits").select("*"),
      db.rpc("wallet_discrepancies"),
      db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("service_status").select("*"),
      db.from("service_waitlist").select("email, created_at, notified_at, notify_error").order("created_at", { ascending: false }).limit(200),
    ]);
    const emails = new Map((users.data?.users ?? []).map((u) => [u.id, u.email ?? u.id]));
    const owner = new Map((budgets.data ?? []).map((b) => [b.id, b]));
    const perUser = new Map<string, { email: string; models: number; credits_bought: number; credits_spent: number; refunds: number; balance: number; tokens: number; requests: number; qwen_usd: number }>();
    const row = (id: string) => {
      if (!perUser.has(id)) perUser.set(id, { email: emails.get(id) ?? id, models: 0, credits_bought: 0, credits_spent: 0, refunds: 0, balance: 0, tokens: 0, requests: 0, qwen_usd: 0 });
      return perUser.get(id)!;
    };
    for (const r of runs.data ?? []) if (r.mode === "train") row(r.user_id).models++;
    for (const l of ledger.data ?? []) {
      const u = row(l.user_id);
      if (l.kind === "purchase" || l.kind === "promo") u.credits_bought += Number(l.delta);
      if (l.kind === "charge") u.credits_spent -= Number(l.delta);
      if (l.kind === "refund") u.refunds += Number(l.delta);
    }
    for (const w of wallets.data ?? []) row(w.user_id).balance = Number(w.balance);
    let qwenUsd = 0;
    for (const t of tokens.data ?? []) {
      const b = owner.get(t.budget_id);
      const usd = t.prompt_tokens * PRICE_IN + t.completion_tokens * PRICE_OUT + (t.searched ? 0.01 : 0);
      qwenUsd += usd;
      if (!b) continue;
      const u = row(b.user_id);
      u.tokens += t.prompt_tokens + t.completion_tokens;
      u.requests++;
      u.qwen_usd += usd;
    }
    // Revenue excludes GST (collected for the government); kept per currency, never added across currencies.
    const byCurrency: Record<string, { revenue: number; gst: number }> = {};
    for (const o of orders.data ?? []) {
      const c = (byCurrency[o.currency] ??= { revenue: 0, gst: 0 });
      c.revenue += (o.amount_cents - (o.tax_cents ?? 0)) / 100;
      c.gst += (o.tax_cents ?? 0) / 100;
    }
    const outstanding = (wallets.data ?? []).reduce((n, w) => n + Number(w.balance), 0);
    return NextResponse.json({
      services: services(),
      totals: {
        users: emails.size, activeUsers: new Set((runs.data ?? []).map((r) => r.user_id)).size, models: (runs.data ?? []).filter((r) => r.mode === "train").length,
        revenue: byCurrency, qwenUsd, outstandingCredits: outstanding,
        failedRuns: (runs.data ?? []).filter((r) => r.final_stage === "failed").length,
      },
      users: [...perUser.values()].sort((a, b) => b.tokens - a.tokens),
      alerts: alerts.data ?? [], limits: limits.data ?? [], discrepancies: gaps.data ?? [], audit: audit.data ?? [],
      status: status.data ?? [], waitlist: waitlist.data ?? [],
      versions: { pricing: PRICING_VERSION, registry: REGISTRY_VERSION },
      notes: ["Qwen costs are estimated from provider-reported tokens at list price; RunPod spend isn't read from RunPod yet."],
    });
  } catch (e) {
    if (e instanceof MissingKeys) return NextResponse.json({ error: e.message }, { status: 503 });
    throw e;
  }
}

// Admin actions, each written to the audit log: change a limit, resolve an alert, adjust a user's credits.
export async function POST(req: Request) {
  const admin = await adminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const body = await req.json();
  const db = supabaseAdmin();
  const log = (action: string, target: string, meta: object) => db.from("audit_log").insert({ actor: admin.email, action, target, meta });
  if (body.action === "set_limit" && typeof body.key === "string" && Number.isFinite(Number(body.value))) {
    await db.from("app_limits").update({ value: Number(body.value), updated_at: new Date().toISOString() }).eq("key", body.key);
    await log("set_limit", body.key, { value: Number(body.value) });
  } else if (body.action === "resolve_alert") {
    await db.from("admin_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", Number(body.id));
    await log("resolve_alert", String(body.id), {});
  } else if (body.action === "adjust_credits" && body.user_id && Number.isInteger(body.delta) && String(body.reason || "").trim()) {
    const key = `adjust:${admin.id}:${body.request_id || Date.now()}`;
    const bal = await applyCredits(String(body.user_id), body.delta, body.delta > 0 && body.refund ? "refund" : "adjust", String(body.reason), key, { reason: body.reason }, admin.email ?? "admin");
    await log("adjust_credits", String(body.user_id), { delta: body.delta, reason: body.reason, balance: bal });
  } else if (body.action === "run_checks") {
    const checks = await runChecks(!!body.live, admin.email ?? undefined);
    await log("run_checks", body.live ? "live" : "dry", { results: checks.map((c) => `${c.name}: ${c.status}`) });
    return NextResponse.json({ ok: true, checks });
  } else if (body.action === "simulate_outage") {
    await markDown("qwen", "Simulated by an admin to test the out-of-service flow");
    await log("simulate_outage", "qwen", {});
  } else if (body.action === "probe") {
    const p = await probeQwen();
    if (p.ok) return NextResponse.json({ ok: true, probe: p, emails: await markUp("qwen", admin.email ?? "admin") });
    return NextResponse.json({ ok: true, probe: p });
  } else if (body.action === "mark_up") {
    const emails = await markUp("qwen", admin.email ?? "admin");
    return NextResponse.json({ ok: true, emails });
  } else if (body.action === "retry_emails") {
    return NextResponse.json({ ok: true, emails: await notifyWaitlist("qwen") });
  } else {
    return NextResponse.json({ error: "Unknown or incomplete action." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
