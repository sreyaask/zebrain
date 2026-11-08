import Link from "next/link";
import { productPricing, products } from "@/lib/mock";
import { rupees } from "@/lib/format";

/** One aligned row per product: what it costs and what's included. */
export function PriceList({ links = true }: { links?: boolean }) {
  return (
    <dl className="divide-y divide-line border-y border-line">
      {products.map((p) => (
        <div key={p.slug} className="grid gap-1 py-5 sm:grid-cols-[200px_160px_1fr] sm:items-baseline sm:gap-6">
          <dt className="text-[15px] font-medium text-ink">
            {links ? (
              <Link href={`/products/${p.slug}/`} className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {p.name}
              </Link>
            ) : (
              p.name
            )}
          </dt>
          <dd className="text-lg font-semibold tabular-nums tracking-tight text-ink">{p.priceLabel}</dd>
          <dd className="text-[15px] leading-relaxed text-muted">{p.priceNote}</dd>
        </div>
      ))}
      <div className="grid gap-1 py-5 sm:grid-cols-[200px_160px_1fr] sm:items-baseline sm:gap-6">
        <dt className="text-[15px] font-medium text-ink">Delivery</dt>
        <dd className="text-lg font-semibold tabular-nums tracking-tight text-ink">{rupees(productPricing.deliveryFee)} flat</dd>
        <dd className="text-[15px] leading-relaxed text-muted">Free on orders above {rupees(productPricing.freeDeliveryAbove)}. Anywhere in our Hyderabad areas.</dd>
      </div>
    </dl>
  );
}
