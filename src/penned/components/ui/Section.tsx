import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>;
}

export function SectionHeading({ eyebrow, title, body, id }: { eyebrow?: string; title: string; body?: string; id?: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
      <h2 id={id} className="mt-2 font-display text-[28px] font-light lowercase leading-tight tracking-tight text-ink sm:text-[34px]">
        {title}
      </h2>
      {body && <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-base">{body}</p>}
    </div>
  );
}

export function PageHeader({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pb-8 pt-10 sm:flex-row sm:items-end sm:justify-between sm:pt-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-[34px] font-light lowercase leading-[1.05] tracking-tight text-ink sm:text-5xl">{title}</h1>
        {body && <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-base">{body}</p>}
      </div>
      {children}
    </div>
  );
}
