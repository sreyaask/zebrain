"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { demoUser, getPageSize, getPaper, getProduct, productPricing, timeSlots } from "@/lib/mock";
import { plural, rupees } from "@/lib/format";
import { unitWord } from "@/lib/productPricing";
import { draftQuote, recipientNames, selectedStyle, type OrderDraft, type StepId } from "./types";

function Row({ label, children, onEdit }: { label: string; children: ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-0.5 text-[15px] text-ink">{children}</dd>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded text-sm text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`Edit ${label.toLowerCase()}`}
        >
          Edit
        </button>
      )}
    </div>
  );
}

type Method = "upi" | "card";

function formatCard(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function ReviewStep({
  draft,
  goTo,
  onPaid,
}: {
  draft: OrderDraft;
  goTo: (step: StepId) => void;
  onPaid: (pay: { declined: boolean }) => Promise<void>;
}) {
  const q = draftQuote(draft);
  const paper = getPaper(draft.paper);
  const product = getProduct(draft.product)!;
  const style = selectedStyle(draft);
  const people = recipientNames(draft);
  const isPages = draft.product === "notes" || draft.product === "journals-gifts";
  const slot = timeSlots.find((s) => s.id === draft.delivery.slot);
  const addr =
    draft.delivery.addressMode === "saved"
      ? `${demoUser.savedAddress.line1}, ${demoUser.savedAddress.area}, Hyderabad ${demoUser.savedAddress.pincode}`
      : `${draft.delivery.line1}, ${draft.delivery.area}, Hyderabad ${draft.delivery.pincode}`;

  const [method, setMethod] = useState<Method>("upi");
  const [upi, setUpi] = useState("");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "processing" | "declined">("idle");
  const [orderError, setOrderError] = useState<string | null>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (method === "upi") {
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi.trim())) e.upi = "Enter a UPI ID like arjun@okaxis.";
    } else {
      if (card.number.replace(/\s/g, "").length !== 16) e.number = "Enter the 16-digit card number.";
      const [mm, yy] = card.expiry.split("/").map(Number);
      const now = new Date();
      const expired = !mm || !yy || mm > 12 || 2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1);
      if (expired) e.expiry = "Enter a valid expiry date (MM/YY).";
      if (!/^\d{3}$/.test(card.cvv)) e.cvv = "Enter the 3-digit CVV.";
      if (!card.name.trim()) e.name = "Enter the name on the card.";
    }
    return e;
  };

  const pay = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setState("processing");
    await new Promise((r) => setTimeout(r, method === "upi" ? 2200 : 1600));
    // Demo: these values simulate a declined payment.
    const declined = method === "upi" ? upi.trim().toLowerCase().startsWith("fail@") : card.number.replace(/\s/g, "").endsWith("0002");
    try {
      await onPaid({ declined });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "PAYMENT_DECLINED") setState("declined");
      else {
        setState("idle");
        setOrderError(msg || "Couldn't place the order. Try again.");
      }
    }
  };

  const processing = state === "processing";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="space-y-6">
        <section aria-labelledby="review-order">
          <h3 id="review-order" className="text-sm font-medium text-ink">
            Your order
          </h3>
          <dl className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface px-4">
            <Row label="Product" onEdit={() => goTo("product")}>
              {product.name}
              {draft.title && <span className="block text-sm text-muted">{draft.title}</span>}
            </Row>
            {isPages ? (
              <>
                <Row label="Content" onEdit={() => goTo("upload")}>
                  {draft.mode === "files"
                    ? `${plural(draft.files.length, "file")} uploaded`
                    : `${draft.text.trim().split(/\s+/).filter(Boolean).length} words typed`}
                </Row>
                {draft.product === "notes" && (
                  <Row label="Contents list" onEdit={() => goTo("upload")}>
                    {draft.contentsPage ? "Yes, built from your headings" : "No"}
                  </Row>
                )}
                <Row label="Layout" onEdit={() => goTo("layout")}>
                  <span className="capitalize">{draft.layout.ink}</span> ink · {draft.layout.marginMm} mm margins · {draft.layout.lineSpacing.toFixed(1)}× spacing
                </Row>
                <Row label={draft.product === "journals-gifts" ? "Book" : "Paper"} onEdit={() => goTo(draft.product === "journals-gifts" ? "style" : "paper")}>
                  {style?.name ?? paper.name} · {getPageSize(draft.layout.pageSize).label}
                </Row>
              </>
            ) : (
              <>
                <Row label={draft.product === "business-mail" ? "Stationery" : "Card"} onEdit={() => goTo("style")}>
                  {style?.name} · <span className="capitalize">{draft.layout.ink}</span> ink
                </Row>
                <Row label={draft.product === "invitations" ? "Guests" : "Recipients"} onEdit={() => goTo(draft.product === "business-mail" ? "bulk" : "message")}>
                  {plural(people.length, q.unit.one, q.unit.many)}
                  <span className="block truncate text-sm text-muted">
                    {people.slice(0, 3).join(", ")}
                    {people.length > 3 ? ` and ${people.length - 3} more` : ""}
                  </span>
                </Row>
              </>
            )}
            <Row label="Delivery" onEdit={() => goTo("delivery")}>
              {addr}
              <span className="block text-sm text-muted">
                {slot?.label} · {draft.delivery.name}, +91 {draft.delivery.phone}
              </span>
            </Row>
          </dl>
        </section>

        <section aria-labelledby="review-price">
          <h3 id="review-price" className="text-sm font-medium text-ink">
            Price
          </h3>
          <dl className="mt-2 space-y-2.5 rounded-xl border border-line bg-surface p-4 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">
                {draft.product === "journals-gifts"
                  ? `${style?.name ?? "Book"} · ${plural(q.units, "page")}`
                  : `${product.name} · ${q.billableUnits} ${unitWord(q, q.billableUnits)} × ${rupees(q.unitPrice)}`}
              </dt>
              <dd className="tabular-nums text-ink">{rupees(q.writing)}</dd>
            </div>
            {q.note && <p className="text-xs text-muted">{q.note}</p>}
            {q.notebook > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">New notebook</dt>
                <dd className="tabular-nums text-ink">{rupees(q.notebook)}</dd>
              </div>
            ) : (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Paper and ink</dt>
                <dd className="text-ink">Included</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Delivery</dt>
              <dd className="tabular-nums text-ink">{q.delivery === 0 ? "Free" : rupees(q.delivery)}</dd>
            </div>
            {q.delivery > 0 && (
              <p className="text-xs text-muted">
                Add {rupees(productPricing.freeDeliveryAbove + 1 - q.writing - q.notebook)} more for free delivery.
              </p>
            )}
            <div className="flex justify-between gap-4 border-t border-line pt-3 font-semibold">
              <dt>{q.estimate ? "Estimated total" : "Total"}</dt>
              <dd className="tabular-nums">{rupees(q.total)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section aria-labelledby="pay-title" className="lg:sticky lg:top-24 lg:self-start">
        <form onSubmit={pay} noValidate className="space-y-5 rounded-xl border border-line bg-surface p-5">
          <h3 id="pay-title" className="text-base font-semibold">
            Payment
          </h3>
          <Segmented
            label="Pay with"
            value={method}
            onChange={(m) => {
              setMethod(m);
              setErrors({});
              setState("idle");
            }}
            options={[
              { value: "upi", label: "UPI" },
              { value: "card", label: "Card" },
            ]}
          />

          {method === "upi" ? (
            <div className="animate-fade-in space-y-3">
              <Input
                label="UPI ID"
                placeholder="arjun@okaxis"
                autoComplete="off"
                autoCapitalize="none"
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                error={errors.upi}
                disabled={processing}
                hint="You'll get a request in your UPI app to approve."
              />
            </div>
          ) : (
            <div className="grid animate-fade-in grid-cols-2 gap-3">
              <Input
                label="Card number"
                className="col-span-2"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 5678 9012 3456"
                value={card.number}
                onChange={(e) => setCard({ ...card, number: formatCard(e.target.value) })}
                error={errors.number}
                disabled={processing}
              />
              <Input
                label="Expiry"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={card.expiry}
                onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                error={errors.expiry}
                disabled={processing}
              />
              <Input
                label="CVV"
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={3}
                value={card.cvv}
                onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "") })}
                error={errors.cvv}
                disabled={processing}
              />
              <Input
                label="Name on card"
                className="col-span-2"
                autoComplete="cc-name"
                value={card.name}
                onChange={(e) => setCard({ ...card, name: e.target.value })}
                error={errors.name}
                disabled={processing}
              />
            </div>
          )}

          {state === "declined" && (
            <Alert tone="error" title="Payment declined">
              Your bank didn&apos;t approve this payment. No money was taken. Try again or use another method.
            </Alert>
          )}
          {orderError && (
            <Alert tone="error" title="Order not placed">
              {orderError}
            </Alert>
          )}
          {processing && (
            <p className="text-sm text-muted" role="status" aria-live="polite">
              {method === "upi" ? "Waiting for you to approve in your UPI app..." : "Confirming with your bank..."}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" loading={processing}>
            {processing ? "Processing" : `Pay ${rupees(q.total)}`}
          </Button>
          <p className="text-center text-xs text-muted">Demo checkout. No real payment is made.</p>
        </form>
      </section>
    </div>
  );
}
