"use client";

import { products } from "@/lib/mock";
import { cn } from "@/lib/cn";
import { productDefaults, type OrderDraft } from "./types";

/** "What do you want written?": Notes first and larger, the others in a grid. */
export function ProductStep({ draft, update }: { draft: OrderDraft; update: (patch: Partial<OrderDraft>) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Product</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {products.map((p, i) => {
          const checked = draft.product === p.slug;
          return (
            <label
              key={p.slug}
              className={cn(
                "relative flex cursor-pointer gap-3 rounded-xl border bg-surface p-4 transition-colors",
                "focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-paper",
                checked ? "border-accent shadow-[0_0_0_1px_#C88660]" : "border-line hover:border-ink/25",
                i === 0 && "sm:col-span-2 sm:p-5",
              )}
            >
              <input
                type="radio"
                name="product"
                value={p.slug}
                checked={checked}
                onChange={() => update(productDefaults(p.slug, draft))}
                className="sr-only"
              />
              <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", checked ? "border-accent" : "border-ink/30")} aria-hidden="true">
                {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className={cn("font-medium text-ink", i === 0 ? "text-lg" : "text-[15px]")}>
                    {p.name}
                    {i === 0 && <span className="ml-2 text-xs font-medium text-accent">Main service</span>}
                  </span>
                  <span className="text-sm tabular-nums text-muted">{p.priceLabel}</span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{p.summary}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
