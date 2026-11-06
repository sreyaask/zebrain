"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";
import { StatusPill } from "@/components/ui/StatusPill";
import { Container } from "@/components/ui/Section";
import { orderMeta } from "@/components/OrderRow";
import { demoUser, orders, pricing, type Order } from "@/lib/mock";
import { formatDate, rupees } from "@/lib/format";
import { loadPlacedOrders } from "@/lib/store";
import { cn } from "@/lib/cn";

function Timeline({ order }: { order: Order }) {
  return (
    <ol className="relative">
      {order.timeline.map((e, i) => {
        const last = i === order.timeline.length - 1;
        return (
          <li key={e.status} className="relative flex gap-4 pb-8 last:pb-0">
            {!last && (
              <span
                className={cn("absolute left-[7px] top-5 h-[calc(100%-12px)] w-px", e.state === "done" ? "bg-accent" : "bg-line")}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "relative mt-1 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border",
                e.state === "done" && "border-accent bg-accent",
                e.state === "current" && "border-accent bg-surface",
                e.state === "pending" && "border-line bg-surface",
              )}
              aria-hidden="true"
            >
              {e.state === "done" && (
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white" fill="none">
                  <path d="M2.5 6.2l2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {e.state === "current" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className={cn("text-[15px]", e.state === "pending" ? "text-muted" : "font-medium text-ink")}>
                  {e.label}
                  <span className="sr-only">
                    {e.state === "done" ? " (done)" : e.state === "current" ? " (in progress)" : " (pending)"}
                  </span>
                </p>
                <p className="text-sm tabular-nums text-muted">{e.time ?? (e.state === "pending" ? "Pending" : "")}</p>
              </div>
              {e.detail && <p className="mt-0.5 text-sm text-muted">{e.detail}</p>}
              {e.status === "writing" && e.state === "current" && order.progress && (
                <div className="mt-3">
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-line"
                    role="progressbar"
                    aria-label="Pages written"
                    aria-valuemin={0}
                    aria-valuemax={order.progress.total}
                    aria-valuenow={order.progress.done}
                  >
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(order.progress.done / order.progress.total) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {order.progress.total - order.progress.done} pages to go
                  </p>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [callNote, setCallNote] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const all = [...loadPlacedOrders(), ...orders];
      setOrder(all.find((o) => o.id.toLowerCase() === String(id).toLowerCase()) ?? null);
    }, 350);
    return () => clearTimeout(t);
  }, [id]);

  if (order === undefined) {
    return (
      <Container className="max-w-3xl py-14" >
        <div role="status" aria-label="Loading order" className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="mt-8 h-64 w-full" />
        </div>
      </Container>
    );
  }

  if (order === null) {
    return (
      <Container className="max-w-md py-24 text-center">
        <p className="font-hand text-4xl text-accent">No such order.</p>
        <h1 className="mt-4 text-xl font-semibold">We couldn&apos;t find {String(id).toUpperCase()}</h1>
        <p className="mt-2 text-sm text-muted">Check the order number in your confirmation SMS, or open it from My orders.</p>
        <div className="mt-8 flex justify-center">
          <LinkButton href="/orders">Go to my orders</LinkButton>
        </div>
      </Container>
    );
  }

  const delivered = order.status === "delivered";
  const heroLine = delivered
    ? `Delivered ${order.deliveredAt ?? ""}`
    : order.rider
      ? `Arriving in ${order.rider.eta}`
      : order.eta
        ? `Expected by ${order.eta}`
        : "In progress";

  return (
    <Container className="max-w-3xl pb-8 pt-10 sm:pt-14">
      <Link href="/orders" className="rounded text-sm text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        ← My orders
      </Link>
      <div className="mt-6 flex animate-slide-up flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs text-muted">{order.id}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{order.title}</h1>
          <p className="mt-1.5 text-[15px] text-muted">{orderMeta(order)}</p>
        </div>
        <StatusPill status={order.status} label={order.statusLabel} />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 sm:p-6">
          <p className="text-sm text-muted">{delivered ? "Status" : "ETA"}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight" aria-live="polite">
            {heroLine}
          </p>
          <div className="mt-8">
            <Timeline order={order} />
          </div>
        </Card>

        <div className="space-y-4">
          {order.rider && (
            <Card className="animate-fade-in p-5">
              <p className="text-sm text-muted">Your rider</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-sm font-medium" aria-hidden="true">
                  {order.rider.name.split(" ").map((p) => p[0]).join("")}
                </span>
                <div>
                  <p className="text-[15px] font-medium">{order.rider.name}</p>
                  <p className="text-sm text-muted">ETA {order.rider.eta}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCallNote(true)}
                className="mt-4 flex h-10 w-full items-center justify-center rounded-xl border border-line text-sm font-medium hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Call rider
              </button>
              {callNote && (
                <p className="mt-2 animate-fade-in text-xs text-muted" role="status">
                  {order.rider.name} will call you on arrival. Calls go through a masked number, so neither of you sees the other&apos;s.
                </p>
              )}
            </Card>
          )}
          <Card className="p-5">
            <p className="text-sm text-muted">Delivering to</p>
            <p className="mt-1 text-[15px]">
              {demoUser.name}
              <span className="block text-muted">
                {order.area === demoUser.savedAddress.area
                  ? `${demoUser.savedAddress.line1}, ${demoUser.savedAddress.area}, Hyderabad ${demoUser.savedAddress.pincode}`
                  : `${order.area}, Hyderabad`}
              </span>
            </p>
          </Card>
          <Card className="p-5">
            <div className="flex justify-between text-[15px]">
              <span className="text-muted">Total paid</span>
              <span className="font-medium tabular-nums">{rupees(order.total)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted">Placed</span>
              <span>{formatDate(order.placedOn)}</span>
            </div>
          </Card>
          {delivered && (
            <p className="px-1 text-sm text-muted">
              Not happy with a page? We rewrite it free within {pricing.rewriteWindowHours} hours of delivery.
            </p>
          )}
        </div>
      </div>
    </Container>
  );
}
