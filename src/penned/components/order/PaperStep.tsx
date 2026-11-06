"use client";

import { RadioCard } from "@/components/ui/RadioCard";
import { Alert } from "@/components/ui/Alert";
import { getPageSize, paperOptions, pricing, type PaperOption } from "@/lib/mock";
import { rupees, plural } from "@/lib/format";
import { contentPages, draftQuote, type OrderDraft } from "./types";

export function PaperStep({ draft, update }: { draft: OrderDraft; update: (patch: Partial<OrderDraft>) => void }) {
  const pages = contentPages(draft);
  const q = draftQuote(draft);
  const isCard = draft.paper === "premium-card";

  const choose = (p: PaperOption) => {
    update({ paper: p.id, layout: { ...draft.layout, pageSize: p.size } });
  };

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="sr-only">Paper</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {paperOptions.map((p) => (
            <RadioCard
              key={p.id}
              name="paper"
              value={p.id}
              checked={draft.paper === p.id}
              onChange={() => choose(p)}
              title={p.name}
              aside={`${rupees(p.pricePerUnit)}/${p.unit}`}
              description={
                <>
                  {p.description}
                  <span className="mt-1 block text-xs">
                    {getPageSize(p.size).label}
                    {p.minimum ? ` · ${p.minimum}-page minimum` : ""}
                  </span>
                </>
              }
            />
          ))}
        </div>
      </fieldset>

      <p className="text-sm text-muted">Page size is set to {getPageSize(draft.layout.pageSize).label} to match this paper.</p>

      {isCard ? (
        <div className="space-y-4">
          <div>
            <p id="copies-label" className="text-sm font-medium text-ink">
              Number of cards
            </p>
            <div className="mt-2 flex items-center gap-3" role="group" aria-labelledby="copies-label">
              <button
                type="button"
                onClick={() => update({ copies: Math.max(1, draft.copies - 1) })}
                className="h-10 w-10 rounded-xl border border-line bg-surface text-lg hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="One fewer card"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={draft.copies}
                onChange={(e) => update({ copies: Math.min(500, Math.max(1, Number(e.target.value) || 1)) })}
                className="h-10 w-20 rounded-xl border border-line bg-surface text-center tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                aria-labelledby="copies-label"
              />
              <button
                type="button"
                onClick={() => update({ copies: Math.min(500, draft.copies + 1) })}
                className="h-10 w-10 rounded-xl border border-line bg-surface text-lg hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="One more card"
              >
                +
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">Each card is written individually with the same text.</p>
          </div>
          {pages > 1 && (
            <Alert tone="info" title="Your text is longer than one card">
              It would need about {pages} card faces. Shorten the text, or choose loose A4 for letters.
            </Alert>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Handwritten pages</span>
            <span className="font-medium tabular-nums text-ink">{pages}</span>
          </div>
          {q.minimumApplied && (
            <p className="mt-2 text-muted">
              Notebooks have a {pricing.notebookMinimumPages}-page minimum, so you&apos;ll be charged for {q.billableUnits} pages. Remaining
              pages are left blank for you.
            </p>
          )}
          {q.notebooks && q.notebooks > 1 && <p className="mt-2 text-muted">This fills {plural(q.notebooks, "notebook")}.</p>}
        </div>
      )}
    </div>
  );
}
