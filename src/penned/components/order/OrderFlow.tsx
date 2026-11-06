"use client";

import { useEffect, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stepper } from "@/components/ui/Stepper";
import { demoUser, getPaper, timeSlots, type Order } from "@/lib/mock";
import { rupees } from "@/lib/format";
import { savePlacedOrder } from "@/lib/store";
import { UploadStep } from "./UploadStep";
import { LayoutStep } from "./LayoutStep";
import { PaperStep } from "./PaperStep";
import { DeliveryStep, validateDelivery, type DeliveryErrors } from "./DeliveryStep";
import { ReviewStep } from "./ReviewStep";
import { contentPages, draftQuote, initialDraft, type OrderDraft } from "./types";

const steps = ["Upload", "Layout", "Paper", "Delivery", "Review & pay"];

const stepCopy: { title: string; body: string }[] = [
  { title: "What should we write?", body: "Upload photos or a PDF of the pages to copy, or type the text yourself." },
  { title: "Set up the page", body: "Changes show instantly in the preview. Nothing is written until you pay." },
  { title: "Choose your paper", body: "Paper and ink are included in the price." },
  { title: "Where should we deliver?", body: "We deliver within our Hyderabad areas in 2–3 hours." },
  { title: "Review and pay", body: "Check everything once. You can still go back and change any step." },
];

function nowTime() {
  return new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
}

export function OrderFlow() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OrderDraft>(initialDraft);
  const [uploadError, setUploadError] = useState<string>();
  const [deliveryErrors, setDeliveryErrors] = useState<DeliveryErrors>({});
  const [placed, setPlaced] = useState<Order | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, placed]);

  const update = (patch: Partial<OrderDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    if (patch.files || patch.text !== undefined || patch.mode) setUploadError(undefined);
    if (patch.delivery) setDeliveryErrors({});
  };

  const next = () => {
    if (step === 0) {
      if (draft.mode === "files" && draft.files.length === 0) {
        setUploadError("Add at least one photo or PDF to continue.");
        return;
      }
      if (draft.mode === "text" && draft.text.trim().length < 10) {
        setUploadError("Type or paste the text you'd like written. It needs at least a sentence.");
        return;
      }
    }
    if (step === 3) {
      const e = validateDelivery(draft.delivery);
      setDeliveryErrors(e);
      if (Object.keys(e).length) return;
    }
    setStep((s) => Math.min(steps.length - 1, s + 1));
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const onPaid = () => {
    const q = draftQuote(draft);
    const paper = getPaper(draft.paper);
    const id = `PEN-${1043 + Math.floor(Math.random() * 40)}`;
    const area = draft.delivery.addressMode === "saved" ? demoUser.savedAddress.area : draft.delivery.area || "Kondapur";
    const order: Order = {
      id,
      title: draft.title.trim() || (paper.unit === "card" ? `Cards ×${draft.copies}` : `Handwritten notes, ${q.units} pages`),
      quantity: q.units,
      unit: paper.unit,
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
          {rupees(placed.total)} paid. A writer is being assigned now, and you&apos;ll be able to follow every page.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href={`/orders/${placed.id}`}>Track this order</LinkButton>
          <LinkButton href="/orders" variant="secondary">
            My orders
          </LinkButton>
        </div>
      </Card>
    );
  }

  const q = draftQuote(draft);
  const pages = contentPages(draft);

  return (
    <div>
      <Stepper steps={steps} current={step} onStepClick={setStep} />

      <div key={step} className="mt-10 animate-slide-up">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight focus:outline-none sm:text-2xl">
          {stepCopy[step].title}
        </h2>
        <p className="mt-1.5 text-[15px] text-muted">{stepCopy[step].body}</p>

        <div className="mt-8">
          {step === 0 && <UploadStep draft={draft} update={update} error={uploadError} />}
          {step === 1 && <LayoutStep draft={draft} update={update} />}
          {step === 2 && <PaperStep draft={draft} update={update} />}
          {step === 3 && <DeliveryStep draft={draft} update={update} errors={deliveryErrors} />}
          {step === 4 && <ReviewStep draft={draft} goTo={setStep} onPaid={onPaid} />}
        </div>
      </div>

      {step < 4 && (
        <div className="sticky bottom-0 z-10 -mx-5 mt-10 border-t border-line bg-paper/95 px-5 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 text-sm" aria-live="polite">
              {pages > 0 || draft.paper === "premium-card" ? (
                <>
                  <p className="font-medium tabular-nums text-ink">{rupees(q.total)}</p>
                  <p className="truncate text-muted">
                    {q.billableUnits} {q.unitLabel}s{q.delivery === 0 ? " · free delivery" : ` · incl. ${rupees(q.delivery)} delivery`}
                  </p>
                </>
              ) : (
                <p className="text-muted">Add content to see your price</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {step > 0 && (
                <Button variant="secondary" onClick={back}>
                  Back
                </Button>
              )}
              <Button onClick={next}>Continue</Button>
            </div>
          </div>
        </div>
      )}
      {step === 4 && (
        <div className="mt-8">
          <Button variant="ghost" onClick={back}>
            ← Back to delivery
          </Button>
        </div>
      )}
    </div>
  );
}
