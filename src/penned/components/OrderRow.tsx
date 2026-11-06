import Link from "next/link";
import { StatusPill } from "@/components/ui/StatusPill";
import { getPaper, type Order } from "@/lib/mock";
import { formatDate, rupees } from "@/lib/format";

export function orderMeta(o: Order) {
  const paper = getPaper(o.paper);
  const qty = o.unit === "page" ? `${o.quantity} pages` : `${o.quantity} ${o.unit}s`;
  return `${qty} · ${paper.name} · ${o.ink === "blue" ? "Blue" : "Black"} ink`;
}

export function OrderRow({ order }: { order: Order }) {
  const sub =
    order.status === "delivered"
      ? `Delivered ${order.deliveredAt ?? formatDate(order.placedOn)}`
      : order.rider
        ? `${order.rider.name} arriving in ${order.rider.eta}`
        : order.eta
          ? `ETA ${order.eta}`
          : `Placed ${formatDate(order.placedOn)}`;
  return (
    <li>
      <Link
        href={`/orders/${order.id}`}
        className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted">{order.id}</span>
          </div>
          <p className="mt-0.5 truncate text-[15px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">{order.title}</p>
          <p className="mt-0.5 text-sm text-muted">{orderMeta(order)}</p>
        </div>
        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1.5">
          <StatusPill status={order.status} label={order.statusLabel} />
          <p className="text-sm text-muted">
            <span className="tabular-nums text-ink">{rupees(order.total)}</span> · {sub}
          </p>
        </div>
      </Link>
    </li>
  );
}
