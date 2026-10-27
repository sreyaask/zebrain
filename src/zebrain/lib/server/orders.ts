import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { supabaseAdmin } from "./admin";
import { createBudget } from "./qwen";
import { applyCredits } from "./wallet";
import type { Quote } from "@/lib/quote";

// Marks an order paid exactly once: a credit pack adds credits to the wallet; a (legacy) model order gets its Qwen
// token budget. Safe to call from both the Checkout
// handler and the webhook: whichever arrives second finds the order already paid.
export async function markPaid(razorpayOrderId: string, paymentId: string) {
  const db = supabaseAdmin();
  const { data: order } = await db.from("orders").select("*").eq("razorpay_order_id", razorpayOrderId).maybeSingle();
  if (!order) return null;
  if (order.status !== "created") return order;
  if (order.kind === "credits") {
    // Same idempotency key from the Checkout handler and the webhook: the credits land exactly once.
    await applyCredits(order.user_id, order.credits, "purchase", order.id, `pay:${paymentId}`, { package: order.package_id, razorpay_order: razorpayOrderId });
    const { data } = await db.from("orders").update({ status: "paid", razorpay_payment_id: paymentId, paid_at: new Date().toISOString() })
      .eq("id", order.id).eq("status", "created").select().maybeSingle();
    return data ?? order;
  }
  const q = order.quote as Quote;
  const budgetId = await createBudget(order.user_id, order.plan, order.model_name, q.qwen.inputTokens + q.qwen.outputTokens);
  const { data } = await db.from("orders")
    .update({ status: "paid", razorpay_payment_id: paymentId, paid_at: new Date().toISOString(), budget_id: budgetId })
    .eq("id", order.id).eq("status", "created").select().maybeSingle();
  return data ?? order;
}
