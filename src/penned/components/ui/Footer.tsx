import Link from "next/link";
import { deliveryAreas } from "@/lib/mock";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-serif text-xl text-ink">Penned</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
            Notes, letters and cards written in your handwriting with a real pen. Delivered across Hyderabad in 2–3 hours.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-ink">Product</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-ink" href="/order">Start an order</Link></li>
            <li><Link className="hover:text-ink" href="/setup">Set up your handwriting</Link></li>
            <li><Link className="hover:text-ink" href="/pricing">Pricing</Link></li>
            <li><Link className="hover:text-ink" href="/orders">My orders</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium text-ink">Where we deliver</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{deliveryAreas.join(" · ")}</p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted sm:flex-row sm:justify-between sm:px-8">
          <p>© 2026 Penned, Hyderabad</p>
          <p>Free rewrite of any page within 24 hours of delivery.</p>
        </div>
      </div>
    </footer>
  );
}
