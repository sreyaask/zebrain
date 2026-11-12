import type { OrderStatus } from "@/lib/mock";

type PillStatus = OrderStatus | "cancelled";
import { cn } from "@/lib/cn";

const styles: Record<PillStatus, { label: string; cls: string; dot: string }> = {
  received: { label: "Received", cls: "border-line bg-surface text-ink", dot: "bg-muted" },
  writing: { label: "Writing", cls: "border-accent/20 bg-accent-soft text-accent", dot: "bg-accent animate-pulse" },
  quality_check: { label: "Quality check", cls: "border-[#D9B45A]/30 bg-[#211B0C] text-[#E3C478]", dot: "bg-[#D9B45A]" },
  out_for_delivery: { label: "Out for delivery", cls: "border-accent/20 bg-accent-soft text-accent", dot: "bg-accent animate-pulse" },
  delivered: { label: "Delivered", cls: "border-success/25 bg-[#0F2017] text-success", dot: "bg-success" },
  cancelled: { label: "Cancelled", cls: "border-line bg-surface text-muted", dot: "bg-muted" },
};

export function StatusPill({ status, label, className }: { status: PillStatus; label?: string; className?: string }) {
  const s = styles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        s.cls,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
}
