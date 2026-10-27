import { NextResponse } from "next/server";
import { MissingKeys, supabaseAdmin } from "@/lib/server/admin";
import { chargeAmount, createOrder } from "@/lib/server/razorpay";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimited } from "@/lib/server/ratelimit";

// Buy a credit pack. The pack's price comes from the database, never from the browser; credits are added only
// after the payment signature (or the signed webhook) is verified.
export async function POST(req: Request) {
  const { package_id, country } = await req.json();
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (rateLimited(`credits:${user.id}`, 20, 3600000)) return NextResponse.json({ error: "Too many payment attempts. Try again in an hour." }, { status: 429 });
  try {
    const db = supabaseAdmin();
    const { data: pack } = await db.from("credit_packages").select("*").eq("id", String(package_id)).eq("active", true).maybeSingle();
    if (!pack) return NextResponse.json({ error: "That credit pack isn't available." }, { status: 400 });
    const { amount, currency, tax } = chargeAmount(pack.price_cents / 100, country);
    const credits = pack.credits + pack.bonus_credits;
    const { data: row, error } = await db.from("orders").insert({
      user_id: user.id, kind: "credits", package_id: pack.id, credits, amount_cents: amount, currency,
      country: String(country || "").toUpperCase() === "IN" ? "IN" : "INTL", tax_cents: tax,
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const order = await createOrder(amount, currency, row.id, { order: row.id, credits: String(credits) });
    await db.from("orders").update({ razorpay_order_id: order.id }).eq("id", row.id);
    return NextResponse.json({ orderId: row.id, razorpayOrderId: order.id, amount, tax, currency, keyId: process.env.RAZORPAY_KEY_ID, credits, email: user.email });
  } catch (e) {
    if (e instanceof MissingKeys) return NextResponse.json({ error: "Buying credits isn't switched on yet." }, { status: 503 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't start the payment." }, { status: 502 });
  }
}
