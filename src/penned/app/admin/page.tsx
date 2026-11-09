"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { statusLabel, type DbOrder, type DbOrderStatus } from "@/lib/db";
import { getPaper, timeSlots } from "@/lib/mock";
import { rupees } from "@/lib/format";
import { timeAgo } from "@/lib/adminData";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Filter = "open" | "unpaid" | DbOrderStatus | "all";
const filters: { id: Filter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "unpaid", label: "Unpaid" },
  { id: "received", label: "Received" },
  { id: "writing", label: "Writing" },
  { id: "quality_check", label: "QC" },
  { id: "out_for_delivery", label: "Out" },
  { id: "delivered", label: "Delivered" },
  { id: "all", label: "All" },
];

const LIMIT = 500;
/** Work to do: paid orders that aren't finished. Unpaid ones wait in their own tab. */
const isOpen = (o: DbOrder) => o.status !== "delivered" && o.status !== "cancelled" && o.payment_status === "paid";
const isUnpaid = (o: DbOrder) => o.status !== "cancelled" && o.payment_status !== "paid";
const matches = (o: DbOrder, f: Filter) => (f === "all" ? true : f === "open" ? isOpen(o) : f === "unpaid" ? isUnpaid(o) : o.status === f);

export default function OrdersQueue() {
  const [orders, setOrders] = useState<DbOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase().from("orders").select("*").order("created_at", { ascending: false }).limit(LIMIT);
    if (error) setError(error.message);
    else setOrders(data as DbOrder[]);
  }, []);

  useEffect(() => {
    load();
    // Live updates: new orders and status changes appear without refreshing. Bursts (pages-written saves)
    // are collapsed into one reload.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase()
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        clearTimeout(timer);
        timer = setTimeout(load, 1000);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase().removeChannel(ch);
    };
  }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (orders ?? []).filter(
      (o) =>
        matches(o, filter) &&
        (!term || [o.code, o.title, o.receiver_name, o.receiver_phone, o.area].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [orders, filter, q]);

  const count = (f: Filter) => (orders ?? []).filter((o) => matches(o, f)).length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <label className="block sm:w-72">
          <span className="sr-only">Search orders</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, name, phone, area"
            className="h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </label>
      </div>

      <div role="tablist" aria-label="Filter by status" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {filters.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              filter === f.id ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {f.label}
            {orders && <span className="ml-1.5 tabular-nums text-muted">{count(f.id)}</span>}
          </button>
        ))}
      </div>
      {orders?.length === LIMIT && (
        <p className="mt-3 text-sm text-muted">Showing the newest {LIMIT} orders. Search by code to find older ones.</p>
      )}

      {error ? (
        <div className="mt-6 space-y-3">
          <Alert tone="error" title="Couldn't load orders">{error}</Alert>
          <Button variant="secondary" onClick={load}>Try again</Button>
        </div>
      ) : orders === null ? (
        <div className="mt-4 space-y-2" role="status" aria-label="Loading orders">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">{orders.length === 0 ? "No orders yet. New orders appear here as soon as they're placed." : "No orders match this filter."}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="py-2.5 pr-4 font-medium">Order</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Customer</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Job</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Slot</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2.5 pr-4 text-right font-medium">Total</th>
                <th scope="col" className="py-2.5 text-right font-medium">Placed</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className="border-b border-line align-top hover:bg-surface">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/order/?id=${o.id}`} className="font-mono text-[13px] text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      {o.code}
                    </Link>
                    {o.payment_status !== "paid" && <span className="ml-2 text-xs text-danger">{o.payment_status}</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {o.receiver_name}
                    <span className="block text-xs text-muted">{o.area}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="line-clamp-1">{o.title || "Untitled"}</span>
                    <span className="block text-xs text-muted">
                      {o.paper === "premium-card" ? `${o.copies} cards` : `${o.page_count} pages`} · {getPaper(o.paper).name} · {o.ink}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-muted">{timeSlots.find((s) => s.id === o.time_slot)?.label}</td>
                  <td className="py-3 pr-4">
                    {o.status === "cancelled" ? (
                      <span className="text-xs text-muted">Cancelled</span>
                    ) : (
                      <StatusPill status={o.status} label={o.status === "writing" ? `Writing ${o.pages_written}/${o.billable_units}` : statusLabel[o.status]} />
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{rupees(o.total)}</td>
                  <td className="whitespace-nowrap py-3 text-right text-muted">{timeAgo(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
