import { NextResponse } from "next/server";
import { markPaid } from "@/lib/server/orders";
import { webhookSignatureOk } from "@/lib/server/razorpay";
import { MissingKeys } from "@/lib/server/admin";

export const runtime = "nodejs";

// Backup for the Checkout handler (the tab may close before it runs). Set this URL in Razorpay Dashboard →
// Webhooks with the events payment.captured and order.paid, and the same secret as RAZORPAY_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    if (!webhookSignatureOk(raw, req.headers.get("x-razorpay-signature") || "")) return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  } catch (e) {
    if (e instanceof MissingKeys) return NextResponse.json({ error: e.message }, { status: 503 });
    throw e;
  }
  const event = JSON.parse(raw);
  const payment = event?.payload?.payment?.entity;
  if ((event.event === "payment.captured" || event.event === "order.paid") && payment?.order_id) await markPaid(payment.order_id, payment.id);
  return NextResponse.json({ ok: true });
}
