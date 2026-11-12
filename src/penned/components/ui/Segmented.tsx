"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; swatch?: string }[];
  onChange: (v: T) => void;
  className?: string;
}

/** Accessible segmented control built on native radio inputs. */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className={className}>
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="mt-2 flex rounded-xl border border-line bg-paper p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
              "focus-within:ring-2 focus-within:ring-accent",
              value === o.value ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_#3A3734]" : "text-muted hover:text-ink",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.swatch && <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.swatch }} aria-hidden="true" />}
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
