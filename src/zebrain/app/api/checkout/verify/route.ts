import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/admin";
import { markPaid } from "@/lib/server/orders";
import { paymentSignatureOk } from "@/lib/server/razorpay";
import { supabaseServer } from "@/lib/supabase/server";

// Checkout's success handler posts here. The signature is checked against the order id we stored, not the one the
// browser sends back.
export async function POST(req: Request) {
  const { order_id, razorpay_payment_id, razorpay_signature } = await req.json();
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: order } = await supabaseAdmin().from("orders").select("id, user_id, razorpay_order_id").eq("id", order_id).maybeSingle();
  if (!order || order.user_id !== user.id || !order.razorpay_order_id) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!paymentSignatureOk(order.razorpay_order_id, String(razorpay_payment_id), String(razorpay_signature)))
    return NextResponse.json({ error: "The payment couldn't be verified. You haven't been charged twice; contact support if money left your account." }, { status: 400 });
  const paid = await markPaid(order.razorpay_order_id, String(razorpay_payment_id));
  return NextResponse.json({ ok: true, order: paid ? { id: paid.id, status: paid.status } : null });
}
