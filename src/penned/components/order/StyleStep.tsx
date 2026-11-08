"use client";

import { RadioCard } from "@/components/ui/RadioCard";
import { Segmented } from "@/components/ui/Segmented";
import { PagePreview, inkHex } from "@/components/ui/PagePreview";
import { getPageSize, getProduct } from "@/lib/mock";
import { personalise, recipientNames, type OrderDraft } from "./types";

/** Card, stationery or book choice, with ink and a live preview on the chosen paper. */
export function StyleStep({ draft, update }: { draft: OrderDraft; update: (patch: Partial<OrderDraft>) => void }) {
  const product = getProduct(draft.product)!;
  const styles = product.styles ?? [];
  const isBook = draft.product === "journals-gifts";
  const previewMessage = draft.message.trim()
    ? personalise(draft.message, { name: recipientNames(draft)[0] })
    : isBook && draft.text.trim()
      ? draft.text
      : product.sample;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="space-y-6">
        <fieldset>
          <legend className="sr-only">{isBook ? "Book" : "Card"}</legend>
          <div className="grid gap-3">
            {styles.map((s) => (
              <RadioCard
                key={s.id}
                name="style"
                value={s.id}
                checked={draft.styleId === s.id}
                onChange={() =>
                  update({
                    styleId: s.id,
                    paper: s.paper,
                    layout: { ...draft.layout, pageSize: s.size, marginMm: s.size === "a6" ? 9 : 16 },
                  })
                }
                title={s.name}
                description={
                  <>
                    {s.description}
                    <span className="mt-1 block text-xs">{getPageSize(s.size).label}</span>
                  </>
                }
              />
            ))}
          </div>
        </fieldset>
        <Segmented
          label="Ink colour"
          value={draft.layout.ink}
          onChange={(ink) => update({ layout: { ...draft.layout, ink } })}
          options={[
            { value: "blue", label: "Blue", swatch: inkHex.blue },
            { value: "black", label: "Black", swatch: inkHex.black },
          ]}
        />
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="mx-auto max-w-[260px] rounded-xl border border-line bg-paper p-5">
          <PagePreview
            text={previewMessage}
            paper={draft.paper}
            layout={{ ...draft.layout, lineSpacing: draft.layout.pageSize === "a6" ? 1.05 : draft.layout.lineSpacing }}
            caption="Preview in your handwriting style"
          />
        </div>
      </div>
    </div>
  );
}
