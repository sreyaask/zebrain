import { faqs } from "@/lib/mock";

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-xl border border-line bg-surface">
      {faqs.map((f) => (
        <details key={f.q} className="group px-5 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
            {f.q}
            <svg className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-45" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </summary>
          <p className="animate-fade-in pb-5 text-[15px] leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
