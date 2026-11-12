import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function RadioCard({ name, value, checked, onChange, title, description, aside, disabled, className }: RadioCardProps) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer gap-3 rounded-xl border bg-surface p-4 transition-colors",
        "focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-paper",
        checked ? "border-accent shadow-[0_0_0_1px_#C88660]" : "border-line hover:border-ink/25",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
      <span
        className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", checked ? "border-accent" : "border-ink/30")}
        aria-hidden="true"
      >
        {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-[15px] font-medium text-ink">{title}</span>
          {aside && <span className="shrink-0 text-sm text-ink">{aside}</span>}
        </span>
        {description && <span className="mt-1 block text-sm leading-relaxed text-muted">{description}</span>}
      </span>
    </label>
  );
}
