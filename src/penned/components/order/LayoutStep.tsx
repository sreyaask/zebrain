"use client";

import { useId } from "react";
import { PagePreview, inkHex } from "@/components/ui/PagePreview";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Input";
import { pageSizes, type PageSizeId } from "@/lib/mock";
import { defaultLayout, type LayoutSettings } from "@/lib/pricing";
import { contentPages, previewText, type OrderDraft } from "./types";

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className="text-sm tabular-nums text-muted" aria-hidden="true">
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[#1E3A8A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
      />
    </div>
  );
}

export function LayoutStep({ draft, update }: { draft: OrderDraft; update: (patch: Partial<OrderDraft>) => void }) {
  const layout = draft.layout;
  const set = (patch: Partial<LayoutSettings>) => update({ layout: { ...layout, ...patch } });
  const pages = contentPages(draft);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-7">
        <Slider
          label="Margins"
          value={layout.marginMm}
          min={10}
          max={30}
          step={1}
          display={`${layout.marginMm} mm`}
          onChange={(marginMm) => set({ marginMm })}
        />
        <Slider
          label="Line spacing"
          value={layout.lineSpacing}
          min={1}
          max={2}
          step={0.1}
          display={`${layout.lineSpacing.toFixed(1)}×`}
          onChange={(lineSpacing) => set({ lineSpacing })}
        />
        <Segmented
          label="Headings"
          value={layout.headingStyle}
          onChange={(headingStyle) => set({ headingStyle })}
          options={[
            { value: "underline", label: "Underlined" },
            { value: "larger", label: "Larger" },
            { value: "plain", label: "Plain" },
          ]}
        />
        <Segmented
          label="Ink colour"
          value={layout.ink}
          onChange={(ink) => set({ ink })}
          options={[
            { value: "blue", label: "Blue", swatch: inkHex.blue },
            { value: "black", label: "Black", swatch: inkHex.black },
          ]}
        />
        <Select label="Page size" value={layout.pageSize} onChange={(e) => set({ pageSize: e.target.value as PageSizeId })}>
          {pageSizes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} · {s.widthMm} × {s.heightMm} mm
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() => update({ layout: defaultLayout })}
          className="rounded text-sm text-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Reset to defaults
        </button>
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="mx-auto max-w-sm">
          <PagePreview
            text={previewText(draft)}
            layout={layout}
            paper={draft.paper}
            caption={pages > 0 ? `Page 1 of about ${pages} · live preview` : "Live preview"}
          />
        </div>
      </div>
    </div>
  );
}
