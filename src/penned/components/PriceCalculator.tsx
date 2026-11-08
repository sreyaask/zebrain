"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/Input";
import { products, type ProductSlug } from "@/lib/mock";
import { quoteFor, unitWord } from "@/lib/productPricing";
import { rupees } from "@/lib/format";

export function PriceCalculator() {
  const [slug, setSlug] = useState<ProductSlug>("notes");
  const [count, setCount] = useState("38");
  const n = Number(count);
  const valid = count !== "" && Number.isInteger(n) && n > 0 && n <= 2000;
  const product = products.find((p) => p.slug === slug)!;
  const q = valid ? quoteFor(slug, n) : null;

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-line bg-surface p-5">
      <Select label="Product" value={slug} onChange={(e) => setSlug(e.target.value as ProductSlug)}>
        {products.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name}
          </option>
        ))}
      </Select>
      <Input
        label={`Number of ${product.unit.many}`}
        inputMode="numeric"
        value={count}
        onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 4))}
        error={count !== "" && !valid ? "Enter a number between 1 and 2000." : undefined}
      />
      <dl className="space-y-1.5 border-t border-line pt-4 text-sm" aria-live="polite">
        {q ? (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">
                {slug === "journals-gifts" ? `Book with ${q.units} ${unitWord(q, q.units)}` : `${q.billableUnits} ${unitWord(q, q.billableUnits)} × ${rupees(q.unitPrice)}`}
              </dt>
              <dd className="tabular-nums">{rupees(q.writing)}</dd>
            </div>
            {q.note && <p className="text-xs text-muted">{q.note}</p>}
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="tabular-nums">{q.delivery ? rupees(q.delivery) : "Free"}</dd>
            </div>
            <div className="flex justify-between pt-1.5 text-[15px] font-semibold">
              <dt>{q.estimate ? "Estimated total" : "Total"}</dt>
              <dd className="tabular-nums">{rupees(q.total)}</dd>
            </div>
          </>
        ) : (
          <p className="text-muted">Enter a quantity to see the total.</p>
        )}
      </dl>
    </div>
  );
}
