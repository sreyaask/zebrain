"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/Input";
import { paperOptions, type PaperId } from "@/lib/mock";
import { quote } from "@/lib/pricing";
import { rupees } from "@/lib/format";

export function PriceCalculator() {
  const [paper, setPaper] = useState<PaperId>("ruled-notebook");
  const [count, setCount] = useState("38");
  const n = Number(count);
  const valid = count !== "" && Number.isInteger(n) && n > 0 && n <= 1000;
  const p = paperOptions.find((o) => o.id === paper)!;
  const q = valid ? quote(paper, n) : null;

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-line bg-surface p-5">
      <Select label="Paper" value={paper} onChange={(e) => setPaper(e.target.value as PaperId)}>
        {paperOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
      <Input
        label={p.unit === "card" ? "Number of cards" : "Number of pages"}
        inputMode="numeric"
        value={count}
        onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 4))}
        error={count !== "" && !valid ? "Enter a number between 1 and 1000." : undefined}
      />
      <dl className="space-y-1.5 border-t border-line pt-4 text-sm" aria-live="polite">
        {q ? (
          <>
            <div className="flex justify-between">
              <dt className="text-muted">
                {q.billableUnits} {q.unitLabel}s × {rupees(q.unitPrice)}
                {q.minimumApplied && " (minimum)"}
              </dt>
              <dd className="tabular-nums">{rupees(q.writing)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="tabular-nums">{q.delivery ? rupees(q.delivery) : "Free"}</dd>
            </div>
            <div className="flex justify-between pt-1.5 text-[15px] font-semibold">
              <dt>Total</dt>
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
