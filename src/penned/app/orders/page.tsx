"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, EmptyState } from "@/components/ui/Alert";
import { Button, LinkButton } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";
import { Container, PageHeader } from "@/components/ui/Section";
import { OrderRow } from "@/components/OrderRow";
import { fetchOrders, type Order } from "@/lib/mock";
import { loadPlacedOrders } from "@/lib/store";
import { cn } from "@/lib/cn";

type Filter = "active" | "past";

function OrdersList() {
  // Demo states: /orders?demo=empty or /orders?demo=error
  const demo = useSearchParams().get("demo");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");

  const load = useCallback(async () => {
    setOrders(null);
    setError(null);
    try {
      const base = await fetchOrders({ fail: demo === "error", empty: demo === "empty" });
      setOrders(demo === "empty" ? base : [...loadPlacedOrders(), ...base]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [demo]);

  useEffect(() => {
    load();
  }, [load]);

  const active = orders?.filter((o) => o.status !== "delivered") ?? [];
  const past = orders?.filter((o) => o.status === "delivered") ?? [];
  const shown = filter === "active" ? active : past;

  return (
    <>
      <div role="tablist" aria-label="Filter orders" className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1">
        {(["active", "past"] as const).map((f) => (
          <button
            key={f}
            role="tab"
            type="button"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              filter === f ? "bg-paper font-medium text-ink shadow-[0_0_0_1px_#E6E3DC]" : "text-muted hover:text-ink",
            )}
          >
            {f}
            {orders && <span className="ml-1.5 tabular-nums text-muted">{f === "active" ? active.length : past.length}</span>}
          </button>
        ))}
      </div>

      {error ? (
        <div className="space-y-4">
          <Alert tone="error" title="Couldn't load orders">
            {error}
          </Alert>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </div>
      ) : orders === null ? (
        <div className="divide-y divide-line rounded-xl border border-line bg-surface" role="status" aria-label="Loading orders">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          title={filter === "active" ? "No orders in progress" : "No past orders"}
          body={
            filter === "active"
              ? "When you place an order, you'll see every page being written here."
              : "Delivered orders will show up here, with a free rewrite window of 24 hours."
          }
          action={<LinkButton href="/order">Start an order</LinkButton>}
        />
      ) : (
        <ul className="animate-fade-in divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {shown.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </ul>
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <Container className="max-w-4xl">
      <PageHeader title="My orders" body="Everything you've had written, and what's on its way.">
        <LinkButton href="/order">New order</LinkButton>
      </PageHeader>
      <Suspense fallback={null}>
        <OrdersList />
      </Suspense>
    </Container>
  );
}
