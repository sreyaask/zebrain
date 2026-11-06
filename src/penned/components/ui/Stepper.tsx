import { cn } from "@/lib/cn";

interface StepperProps {
  steps: string[];
  current: number; // 0-based
  onStepClick?: (index: number) => void;
}

/** Progress bar + step labels. Completed steps can be clicked to go back. */
export function Stepper({ steps, current, onStepClick }: StepperProps) {
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <nav aria-label="Order progress">
      <div className="flex items-baseline justify-between text-sm">
        <p className="font-medium text-ink">
          Step {current + 1} of {steps.length}
          <span className="text-muted"> · {steps[current]}</span>
        </p>
      </div>
      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        aria-label="Order progress"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-3 hidden grid-cols-5 gap-2 sm:grid">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = done && onStepClick;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "w-full rounded-md text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active ? "font-medium text-ink" : done ? "text-accent hover:underline" : "text-muted",
                  !clickable && "cursor-default",
                )}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
