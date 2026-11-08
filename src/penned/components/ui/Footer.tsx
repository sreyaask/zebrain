import Link from "next/link";
import { deliveryAreas, products } from "@/lib/mock";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <p className="font-serif text-xl text-ink">Penned</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
            Your handwriting, delivered. Written with a real pen on real paper, across Hyderabad in 2–3 hours.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-ink">What we write</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {products.map((p) => (
              <li key={p.slug}>
                <Link className="hover:text-ink" href={`/products/${p.slug}/`}>
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium text-ink">Penned</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-ink" href="/order/">Get started</Link></li>
            <li><Link className="hover:text-ink" href="/setup/">Set up your handwriting</Link></li>
            <li><Link className="hover:text-ink" href="/pricing/">Pricing</Link></li>
            <li><Link className="hover:text-ink" href="/orders/">My orders</Link></li>
            <li><Link className="hover:text-ink" href="/login/">Log in</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium text-ink">Where we deliver</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">Hyderabad only for now: {deliveryAreas.join(" · ")}</p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted sm:flex-row sm:justify-between sm:px-8">
          <p>© 2026 Penned, Hyderabad</p>
          <p>Free rewrite of any page or card within 24 hours of delivery.</p>
        </div>
      </div>
    </footer>
  );
}
