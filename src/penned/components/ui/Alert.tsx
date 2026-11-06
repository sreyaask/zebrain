import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "error" | "success";

const tones: Record<Tone, string> = {
  info: "border-accent/20 bg-accent-soft text-accent",
  error: "border-danger/25 bg-[#FDF2F1] text-danger",
  success: "border-success/25 bg-[#EEF6F1] text-success",
};

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <p className="font-hand text-3xl text-accent" aria-hidden="true">
        Nothing here yet
      </p>
      <h2 className="mt-3 text-base font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
