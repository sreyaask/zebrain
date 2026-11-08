"use client";

import { RadioCard } from "@/components/ui/RadioCard";
import { getPageSize, paperOptions, productPricing, type PaperOption } from "@/lib/mock";
import { rupees, plural } from "@/lib/format";
import { contentPages, draftQuote, type OrderDraft } from "./types";

/** Notes: notebook paper. Notebooks keep the size picked in the upload step; loose sheets are A4. */
export function PaperStep({ draft, update }: { draft: OrderDraft; update: (patch: Partial<OrderDraft>) => void }) {
  const pages = contentPages(draft);
  const q = draftQuote(draft);
  const options = paperOptions.filter((p) => p.id !== "premium-card");
  const notebooks = q.billableUnits > 0 ? Math.ceil(q.billableUnits / 100) : 0;

  const choose = (p: PaperOption) => {
    const keepSize = p.id !== "loose-a4" && draft.layout.pageSize !== "a6";
    update({ paper: p.id, layout: { ...draft.layout, pageSize: keepSize ? draft.layout.pageSize : p.size } });
  };

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="sr-only">Paper</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((p) => (
            <RadioCard
              key={p.id}
              name="paper"
              value={p.id}
              checked={draft.paper === p.id}
              onChange={() => choose(p)}
              title={p.name}
              aside={`${rupees(productPricing.notes.perPage)}/page`}
              description={
                <>
                  {p.description}
                  {p.minimum ? <span className="mt-1 block text-xs">{p.minimum}-page minimum</span> : null}
                </>
              }
            />
          ))}
        </div>
      </fieldset>

      <p className="text-sm text-muted">Written on {getPageSize(draft.layout.pageSize).label} pages.</p>

      <div className="rounded-xl border border-line bg-surface p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Handwritten pages</span>
          <span className="font-medium tabular-nums text-ink">{pages}</span>
        </div>
        {q.note && <p className="mt-2 text-muted">{q.note} Remaining pages are left blank for you.</p>}
        {draft.paper !== "loose-a4" && notebooks > 1 && <p className="mt-2 text-muted">This fills {plural(notebooks, "notebook")}.</p>}
      </div>
    </div>
  );
}
