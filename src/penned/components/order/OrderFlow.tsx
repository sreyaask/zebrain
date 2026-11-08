"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stepper } from "@/components/ui/Stepper";
import { demoUser, getProduct, timeSlots, type Order, type ProductSlug } from "@/lib/mock";
import { rupees } from "@/lib/format";
import { unitWord } from "@/lib/productPricing";
import { savePlacedOrder } from "@/lib/store";
import { live, placeOrder } from "@/lib/api";
import { ProductStep } from "./ProductStep";
import { UploadStep } from "./UploadStep";
import { LayoutStep } from "./LayoutStep";
import { PaperStep } from "./PaperStep";
import { StyleStep } from "./StyleStep";
import { MessageStep } from "./MessageStep";
import { BulkStep } from "./BulkStep";
import { DeliveryStep, validateDelivery, type DeliveryErrors } from "./DeliveryStep";
import { ReviewStep } from "./ReviewStep";
import {
  contentPages,
  draftQuote,
  flows,
  initialDraft,
  orderText,
  orderUnits,
  productDefaults,
  recipientNames,
  selectedStyle,
  stepCopy,
  stepLabel,
  type OrderDraft,
  type StepId,
} from "./types";

function nowTime() {
  return new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
}

const slugs = Object.keys(flows) as ProductSlug[];

export function OrderFlow() {
  const requested = useSearchParams().get("product");
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<OrderDraft>(() => {
    const base = live ? { ...initialDraft, delivery: { ...initialDraft.delivery, addressMode: "new" as const, name: "", phone: "" } } : initialDraft;
    const slug = slugs.includes(requested as ProductSlug) ? (requested as ProductSlug) : "notes";
    return { ...base, ...productDefaults(slug, base) };
  });
  const [uploadError, setUploadError] = useState<string>();
  const [messageErrors, setMessageErrors] = useState<{ message?: string; recipients?: string }>({});
  const [deliveryErrors, setDeliveryErrors] = useState<DeliveryErrors>({});
  const [placed, setPlaced] = useState<Order | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const flow = flows[draft.product];
  const stepId: StepId = flow[Math.min(stepIndex, flow.length - 1)];

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [stepIndex, placed]);

  const update = (patch: Partial<OrderDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    if (patch.files || patch.text !== undefined || patch.mode) setUploadError(undefined);
    if (patch.message !== undefined || patch.recipients !== undefined || patch.csv !== undefined) setMessageErrors({});
    if (patch.delivery) setDeliveryErrors({});
  };

  const goTo = (id: StepId) => {
    const i = flow.indexOf(id);
    if (i >= 0) setStepIndex(i);
  };

  const validate = (): boolean => {
    if (stepId === "upload") {
      if (draft.mode === "files" && draft.files.length === 0) {
        setUploadError("Add at least one photo or PDF to continue.");
        return false;
      }
      if (draft.mode === "text" && draft.text.trim().length < 10) {
        setUploadError("Type or paste the text you'd like written. It needs at least a sentence.");
        return false;
      }
    }
    if (stepId === "message" || stepId === "bulk") {
      const e: { message?: string; recipients?: string } = {};
      if (draft.message.trim().length < 5) e.message = "Write the message you'd like on each card.";
      if (recipientNames(draft).length === 0)
        e.recipients = stepId === "bulk" ? "Upload a CSV with at least one recipient." : "Add at least one name, one per line.";
      setMessageErrors(e);
      if (Object.keys(e).length) return false;
    }
    if (stepId === "delivery") {
      const e = validateDelivery(draft.delivery);
      setDeliveryErrors(e);
      if (Object.keys(e).length) return false;
    }
    return true;
  };

  const next = () => {
    if (!validate()) return;
    setStepIndex((s) => Math.min(flow.length - 1, s + 1));
  };
  const back = () => setStepIndex((s) => Math.max(0, s - 1));

  const onPaid = async (pay: { declined: boolean }) => {
    const product = getProduct(draft.product)!;
    const isPages = draft.product === "notes" || draft.product === "journals-gifts";
    const units = orderUnits(draft);
    const title = draft.title.trim() || (isPages ? `${product.name}, ${units} ${units === 1 ? "page" : "pages"}` : `${product.name} ×${units}`);

    if (live) {
      // Existing order API: cards, invites and business notes go as typed text with the recipient list.
      const order = await placeOrder(
        {
          title,
          mode: isPages ? draft.mode : "text",
          text: orderText(draft),
          files: isPages ? draft.files : [],
          layout: draft.layout,
          paper: draft.paper,
          copies: isPages ? 1 : Math.max(1, units),
          pageCount: isPages ? contentPages(draft) : 1,
          delivery: { ...draft.delivery, useSaved: draft.delivery.addressMode === "saved", slot: draft.delivery.slot || "within-3h" },
        },
        pay,
      );
      setPlaced(order);
      return;
    }
    if (pay.declined) throw new Error("PAYMENT_DECLINED");
    const q = draftQuote(draft);
    const id = `PEN-${1043 + Math.floor(Math.random() * 40)}`;
    const area = draft.delivery.addressMode === "saved" ? demoUser.savedAddress.area : draft.delivery.area || "Kondapur";
    const order: Order = {
      id,
      title,
      quantity: q.units,
      unit: isPages ? "page" : "card",
      paper: draft.paper,
      ink: draft.layout.ink,
      total: q.total,
      status: "received",
      statusLabel: "Received",
      placedOn: new Date().toISOString().slice(0, 10),
      eta: timeSlots.find((s) => s.id === draft.delivery.slot)?.label,
      progress: { done: 0, total: q.units },
      area,
      timeline: [
        { status: "received", label: "Received", time: nowTime(), state: "current", detail: "Assigning a writer" },
        { status: "writing", label: "Writing", state: "pending" },
        { status: "quality_check", label: "Quality check", state: "pending" },
        { status: "out_for_delivery", label: "Out for delivery", state: "pending" },
        { status: "delivered", label: "Delivered", state: "pending" },
      ],
    };
    savePlacedOrder(order);
    setPlaced(order);
  };

  if (placed) {
    return (
      <Card className="mx-auto max-w-lg animate-slide-up p-6 text-center sm:p-10">
        <p className="font-hand text-5xl text-accent">Thank you.</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-xl font-semibold focus:outline-none">
          Order {placed.id} is placed
        </h2>
        <p className="mt-2 text-[15px] text-muted">
          {rupees(placed.total)} paid. A pen machine is being set up with your handwriting, and you&apos;ll be able to follow every page.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href={live ? `/orders/track/?code=${placed.id}` : `/orders/${placed.id}/`}>Track this order</LinkButton>
          <LinkButton href="/orders/" variant="secondary">
            My orders
          </LinkButton>
        </div>
      </Card>
    );
  }

  const q = draftQuote(draft);
  const style = selectedStyle(draft);
  const copy = stepCopy(stepId, draft.product);
  const isReview = stepId === "review";

  return (
    <div>
      <Stepper steps={flow.map((id) => stepLabel(id, draft.product))} current={stepIndex} onStepClick={setStepIndex} />

      <div key={`${draft.product}-${stepId}`} className="mt-10 animate-slide-up">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight focus:outline-none sm:text-2xl">
          {copy.title}
        </h2>
        <p className="mt-1.5 text-[15px] text-muted">{copy.body}</p>

        <div className="mt-8">
          {stepId === "product" && <ProductStep draft={draft} update={update} />}
          {stepId === "upload" && <UploadStep draft={draft} update={update} error={uploadError} />}
          {stepId === "layout" && <LayoutStep draft={draft} update={update} />}
          {stepId === "paper" && <PaperStep draft={draft} update={update} />}
          {stepId === "style" && <StyleStep draft={draft} update={update} />}
          {stepId === "message" && <MessageStep draft={draft} update={update} errors={messageErrors} />}
          {stepId === "bulk" && <BulkStep draft={draft} update={update} errors={messageErrors} />}
          {stepId === "delivery" && <DeliveryStep draft={draft} update={update} errors={deliveryErrors} />}
          {isReview && <ReviewStep draft={draft} goTo={goTo} onPaid={onPaid} />}
        </div>
      </div>

      {!isReview && (
        <div className="sticky bottom-0 z-10 -mx-5 mt-10 border-t border-line bg-paper/95 px-5 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 text-sm" aria-live="polite">
              {q.total > 0 ? (
                <>
                  <p className="font-medium tabular-nums text-ink">
                    {q.estimate ? "About " : ""}
                    {rupees(q.total)}
                  </p>
                  <p className="truncate text-muted">
                    {getProduct(draft.product)!.name}
                    {draft.product === "journals-gifts"
                      ? ` · ${style?.name ?? "Book"}`
                      : ` · ${q.billableUnits} ${unitWord(q, q.billableUnits)}`}
                    {q.delivery === 0 ? " · free delivery" : ""}
                  </p>
                </>
              ) : (
                <p className="text-muted">
                  {getProduct(draft.product)!.name} · {getProduct(draft.product)!.priceLabel}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {stepIndex > 0 && (
                <Button variant="secondary" onClick={back}>
                  Back
                </Button>
              )}
              <Button onClick={next}>Continue</Button>
            </div>
          </div>
        </div>
      )}
      {isReview && (
        <div className="mt-8">
          <Button variant="ghost" onClick={back}>
            ← Back to delivery
          </Button>
        </div>
      )}
    </div>
  );
}
