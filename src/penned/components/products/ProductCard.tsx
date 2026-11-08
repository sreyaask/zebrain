import Link from "next/link";
import type { Product } from "@/lib/mock";
import { cn } from "@/lib/cn";
import { ProductSample } from "./ProductSample";

/** Homepage product card. The featured card (Notes) is larger and shows more. */
export function ProductCard({ product, featured = false }: { product: Product; featured?: boolean }) {
  return (
    <Link
      href={`/products/${product.slug}/`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-ink/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        featured && "sm:flex-row",
      )}
    >
      {/* Show the top of the sample, large enough to read the handwriting. */}
      <div
        className={cn("relative overflow-hidden border-b border-line bg-paper px-5 pt-5", featured ? "h-60 sm:h-auto sm:min-h-[320px] sm:max-h-[360px] sm:w-[46%] sm:border-b-0 sm:border-r sm:px-8 sm:pt-8" : "h-48")}
        aria-hidden="true"
      >
        {/* Notebook and journal pages are zoomed into their top-left corner so the writing is readable. */}
        <ProductSample
          product={product}
          className={product.sampleSize === "a6" ? cn("mx-auto", featured ? "max-w-[340px]" : "max-w-[300px]") : "!w-[175%] max-w-none sm:!w-[165%]"}
        />
      </div>
      <div className={cn("flex flex-1 flex-col p-5", featured && "sm:justify-center sm:p-8")}>
        {featured && <p className="text-sm font-medium text-accent">Our main service</p>}
        <h3 className={cn("font-semibold text-ink", featured ? "mt-1 text-2xl tracking-tight" : "text-lg")}>{product.name}</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{product.summary}</p>
        {featured && (
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {product.uses.slice(0, 4).map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        )}
        <p className="mt-auto pt-5 text-sm">
          <span className="font-medium tabular-nums text-ink">{product.priceLabel}</span>
          <span className="ml-2 text-accent group-hover:underline group-hover:underline-offset-4">
            See {product.name}
            <span aria-hidden="true"> →</span>
          </span>
        </p>
      </div>
    </Link>
  );
}
