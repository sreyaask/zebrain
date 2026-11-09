"use client";
/**
 * Customer-side data access. When Supabase is configured (NEXT_PUBLIC_SUPABASE_*), everything
 * goes to the real backend. Otherwise the site runs as a demo on lib/mock.ts, unchanged.
 */
import { supabase, supabaseConfigured } from "./supabase";
import { statusFlow, statusLabel, type DbOrder, type DbOrderEvent } from "./db";
import type { DeliveryArea, Order, TimelineEvent, TimeSlotId } from "./mock";
import { demoUser, timeSlots } from "./mock";
import type { LayoutSettings } from "./pricing";
import type { UploadedFile } from "@/components/ui/Uploader";

export const live = supabaseConfigured;

// ---------- Auth ----------

export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  if (!live) return null;
  const { data } = await supabase().auth.getSession();
  return data.session ? { id: data.session.user.id, email: data.session.user.email ?? null } : null;
}

/** Turns Supabase auth errors into something a customer can act on. */
export function authMessage(err: { message?: string; code?: string; status?: number } | null | undefined): string {
  const code = err?.code ?? "";
  const msg = (err?.message ?? "").toLowerCase();
  // With password sign-in, Supabase only sends email when "Confirm email" is on, so an email limit means that setting.
  if (code === "over_email_send_rate_limit" || msg.includes("email rate limit"))
    return "Supabase is trying to send a confirmation email. Turn off \"Confirm email\" in Supabase (Authentication → Sign In / Providers → Email), then try again.";
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "Email or password is wrong.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "An account with this email already exists. Log in instead.";
  if (code === "weak_password" || msg.includes("password should")) return "Use a password of at least 8 characters.";
  if (code === "email_not_confirmed" || msg.includes("not confirmed"))
    return "This account isn't confirmed yet. In Supabase, turn off \"Confirm email\" (Authentication → Sign In / Providers → Email).";
  if (code === "email_address_invalid" || msg.includes("email address")) return "That email address doesn't look right.";
  if (code === "signup_disabled" || msg.includes("signups not allowed")) return "New sign-ups are turned off right now.";
  if (err?.status === 429 || msg.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  return "Something went wrong. Please try again.";
}

/** Email + password, handled entirely by Supabase (no emails are sent when "Confirm email" is off). */
export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase().auth.signUp({ email, password });
  if (error) throw new Error(authMessage(error));
  // With "Confirm email" on, Supabase returns no session and would try to send an email.
  if (!data.session) throw new Error(authMessage({ code: "email_not_confirmed" }));
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(authMessage(error));
}

export async function signOut() {
  if (live) await supabase().auth.signOut();
}

// ---------- Orders ----------

function toTimeline(o: DbOrder, events: DbOrderEvent[]): TimelineEvent[] {
  const currentIdx = statusFlow.indexOf(o.status as (typeof statusFlow)[number]);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  return statusFlow.map((s, i) => {
    const ev = [...events].reverse().find((e) => e.status === s);
    const state: TimelineEvent["state"] =
      o.status === "cancelled" ? (ev ? "done" : "pending") : i < currentIdx || (i === currentIdx && s === "delivered") ? "done" : i === currentIdx ? "current" : "pending";
    const detail =
      s === "writing" && state === "current"
        ? `Page ${o.pages_written} of ${o.billable_units}`
        : s === "out_for_delivery" && state === "current" && o.rider_name
          ? `${o.rider_name} is on the way`
          : (ev?.note ?? undefined);
    return { status: s, label: statusLabel[s], time: ev ? fmt(ev.created_at) : undefined, state, detail };
  });
}

export function toUiOrder(o: DbOrder, events: DbOrderEvent[] = []): Order {
  const isCard = o.paper === "premium-card";
  const statusText =
    o.status === "writing" ? `Writing – page ${o.pages_written} of ${o.billable_units}` : statusLabel[o.status];
  return {
    id: o.code,
    title: o.title || (isCard ? `Cards ×${o.copies}` : `Handwritten pages`),
    quantity: isCard ? o.copies : o.page_count,
    unit: isCard ? "card" : "page",
    paper: o.paper,
    ink: o.ink,
    total: o.total,
    status: o.status,
    statusLabel: o.payment_status === "paid" ? statusText : `${statusText} · payment pending`,
    placedOn: o.created_at.slice(0, 10),
    deliveredAt: o.delivered_at ? new Date(o.delivered_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : undefined,
    eta: o.eta ?? timeSlots.find((t) => t.id === o.time_slot)?.label,
    progress: o.status === "writing" ? { done: o.pages_written, total: o.billable_units } : undefined,
    rider: o.rider_name && o.status === "out_for_delivery" ? { name: o.rider_name, eta: o.eta ?? "soon" } : undefined,
    area: o.area,
    timeline: toTimeline(o, events),
  };
}

export async function myOrders(): Promise<Order[]> {
  const { data, error } = await supabase().from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("We couldn't load your orders. Check your connection and try again.");
  return (data as DbOrder[]).map((o) => toUiOrder(o));
}

export async function orderByCode(code: string): Promise<{ order: Order; address: string } | null> {
  const { data, error } = await supabase().from("orders").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const o = data as DbOrder;
  const { data: ev } = await supabase().from("order_events").select("*").eq("order_id", o.id).order("created_at");
  return { order: toUiOrder(o, (ev ?? []) as DbOrderEvent[]), address: `${o.address_line1}, ${o.area}, Hyderabad ${o.pincode}` };
}

/** Live updates for one order (status, pages written, rider). */
export function watchOrder(code: string, cb: () => void): () => void {
  const sb = supabase();
  const ch = sb
    .channel(`order-${code}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `code=eq.${code.toUpperCase()}` }, cb)
    .subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}

export interface PlaceOrderInput {
  /** Made once per checkout: retries reuse it, so a retry never creates a second order. */
  orderId: string;
  /** The total the customer was shown. If the database prices it differently, nothing is charged. */
  expectedTotal: number;
  title: string;
  mode: "files" | "text";
  text: string;
  files: UploadedFile[];
  layout: LayoutSettings;
  paper: DbOrder["paper"];
  copies: number;
  pageCount: number;
  delivery: {
    useSaved: boolean;
    name: string;
    phone: string;
    line1: string;
    area: DeliveryArea | "";
    pincode: string;
    landmark: string;
    slot: TimeSlotId;
  };
}

/** Thrown when the database's price differs from the one shown; the order stays unpaid. */
export class PriceChangedError extends Error {
  constructor(readonly total: number) {
    super(`The final price for this order is ₹${total}.`);
  }
}

const mimeByExt: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp" };

/**
 * Creates the order (the database sets code and price), uploads the pages, then runs the demo payment.
 * Safe to retry with the same input.orderId: an existing order is reused and uploads overwrite.
 */
export async function placeOrder(input: PlaceOrderInput, pay: { declined: boolean }): Promise<Order> {
  const sb = supabase();
  const user = await currentUser();
  if (!user) throw new Error("Please log in to place an order.");
  const d = input.delivery;
  const saved = demoUser.savedAddress;
  const { data: style } = await sb.from("handwriting_profiles").select("id").eq("status", "ready").order("created_at", { ascending: false }).limit(1).maybeSingle();

  const existing = await sb.from("orders").select("*").eq("id", input.orderId).maybeSingle();
  const { data, error } = existing.data ? { data: existing.data, error: null } : await sb
    .from("orders")
    .insert({
      id: input.orderId,
      title: input.title.trim().slice(0, 120),
      source_mode: input.mode,
      source_text: input.mode === "text" ? input.text : "",
      paper: input.paper,
      ink: input.layout.ink,
      page_size: input.layout.pageSize,
      margin_mm: input.layout.marginMm,
      line_spacing: input.layout.lineSpacing,
      heading_style: input.layout.headingStyle,
      copies: input.paper === "premium-card" ? input.copies : 1,
      page_count: input.pageCount,
      handwriting_profile_id: style?.id ?? null,
      receiver_name: d.name.trim(),
      receiver_phone: d.phone.replace(/\D/g, "").slice(-10),
      address_line1: d.useSaved ? saved.line1 : d.line1.trim(),
      area: d.useSaved ? saved.area : d.area,
      pincode: d.useSaved ? saved.pincode : d.pincode,
      landmark: d.useSaved ? null : d.landmark.trim() || null,
      time_slot: d.slot,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't create the order.");
  const order = data as DbOrder;

  for (let i = 0; i < input.files.length; i++) {
    const f = input.files[i];
    if (!f.file) continue;
    const ext = f.kind === "pdf" ? "pdf" : (f.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${order.id}/${String(i + 1).padStart(2, "0")}.${ext}`;
    const contentType = f.file.type || mimeByExt[ext] || "application/octet-stream";
    const up = await sb.storage.from("uploads").upload(path, f.file, { contentType, upsert: true });
    if (up.error) throw new Error(`Upload failed for ${f.name}: ${up.error.message}`);
    const row = await sb.from("order_files").upsert({ order_id: order.id, path, kind: f.kind, pages: f.pages }, { onConflict: "order_id,path", ignoreDuplicates: true });
    if (row.error) throw new Error(row.error.message);
  }

  if (order.payment_status === "paid") return toUiOrder(order);
  if (order.total !== input.expectedTotal) throw new PriceChangedError(order.total);
  if (pay.declined) throw new Error("PAYMENT_DECLINED");
  const paid = await sb.rpc("demo_mark_paid", { p_order_id: order.id });
  if (paid.error) throw new Error(paid.error.message);
  return toUiOrder({ ...order, payment_status: "paid" });
}

// ---------- Handwriting ----------

export async function myStyles() {
  const { data, error } = await supabase().from("handwriting_profiles").select("id, name, ink, status, review_note, created_at").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as { id: string; name: string; ink: "blue" | "black"; status: string; review_note: string | null; created_at: string }[];
}

export async function uploadStyle(file: File, name: string, ink: "blue" | "black") {
  const user = await currentUser();
  if (!user) throw new Error("Please log in first.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const sb = supabase();
  const up = await sb.storage.from("handwriting").upload(path, file, { contentType: file.type || "image/jpeg" });
  if (up.error) throw new Error(up.error.message);
  const { error } = await sb.from("handwriting_profiles").insert({ name, ink, scan_path: path });
  if (error) throw new Error(error.message);
}

// ---------- Early list ----------

export async function joinEarlyList(email: string, area: string) {
  const { error } = await supabase().from("early_list").insert({ email: email.trim().toLowerCase(), area: area || null });
  // Already on the list counts as success.
  if (error && error.code !== "23505") throw new Error(error.message);
}
