import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireKeys } from "./admin";

// Razorpay one-time payments: the server creates an order for the quoted amount, Checkout collects the payment,
// and the signature proves it. Docs: razorpay.com/docs/payments/server-integration (Orders API, signature check).

const API = "https://api.razorpay.com/v1";

// USD first. Buyers in India pay in rupees (so UPI and netbanking work) with 18% GST added on top; everyone else pays
// in USD with no GST (export of services). USD_INR should be updated regularly; it defaults to 88.
export const GST_RATE = 0.18;

export function chargeAmount(usd: number, country: string | null | undefined) {
  const india = String(country || "").toUpperCase() === "IN";
  const currency = india ? "INR" : "USD";
  const rate = india ? Number(process.env.USD_INR || 88) : 1;
  const base = Math.ceil(usd * rate * 100); // smallest unit: cents / paise
  const tax = india ? Math.round(base * GST_RATE) : 0;
  return { currency, base, tax, amount: base + tax };
}

export async function createOrder(amount: number, currency: string, receipt: string, notes: Record<string, string>) {
  requireKeys("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET");
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency, receipt: receipt.slice(0, 40), notes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(data?.error?.description || "Razorpay didn't create the order.");
  return data as { id: string; amount: number; currency: string };
}

function hmacOk(message: string, secret: string, signature: string) {
  const want = Buffer.from(createHmac("sha256", secret).update(message).digest("hex"));
  const got = Buffer.from(signature || "");
  return want.length === got.length && timingSafeEqual(want, got);
}

// Checkout's handler result: HMAC-SHA256(order_id + "|" + payment_id, key secret). Use the order id we stored.
export function paymentSignatureOk(orderId: string, paymentId: string, signature: string) {
  requireKeys("RAZORPAY_KEY_SECRET");
  return hmacOk(`${orderId}|${paymentId}`, process.env.RAZORPAY_KEY_SECRET!, signature);
}

// Webhooks: X-Razorpay-Signature = HMAC-SHA256(raw body, webhook secret).
export function webhookSignatureOk(rawBody: string, signature: string) {
  requireKeys("RAZORPAY_WEBHOOK_SECRET");
  return hmacOk(rawBody, process.env.RAZORPAY_WEBHOOK_SECRET!, signature);
}
