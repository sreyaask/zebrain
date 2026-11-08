import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { ProductSample } from "@/components/products/ProductSample";
import { getProduct, products, productPricing } from "@/lib/mock";
import { rupees } from "@/lib/format";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}
export const dynamicParams = false;

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = getProduct(params.slug);
  return p ? { title: p.name, description: p.summary } : {};
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProduct(params.slug);
  if (!product) notFound();
  const others = products.filter((p) => p.slug !== product.slug);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <Container className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <nav aria-label="Breadcrumb" className="text-sm text-muted">
              <Link href="/#products" className="hover:text-ink">What we write</Link>
              <span aria-hidden="true"> / </span>
              <span className="text-ink">{product.name}</span>
            </nav>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-ink [text-wrap:balance] sm:text-5xl">{product.tagline}</h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-lg">{product.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <LinkButton href={`/order/?product=${product.slug}`} size="lg">
                Order {product.name}
              </LinkButton>
              <p className="text-sm text-muted">
                <span className="font-medium text-ink">{product.priceLabel}</span> · delivered in 2–3 hours
              </p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-xl border border-line bg-paper p-6 sm:p-10">
            <ProductSample product={product} caption={`Sample written in the "Arjun – Blue Ink" style`} />
          </div>
        </Container>
      </section>

      {/* What it's for */}
      <section aria-labelledby="uses" className="py-14 sm:py-20">
        <Container className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
          <h2 id="uses" className="text-2xl font-semibold tracking-tight text-ink">Made for</h2>
          <ul className="divide-y divide-line border-y border-line">
            {product.uses.map((u) => (
              <li key={u} className="py-3.5 text-[15px] text-ink">{u}</li>
            ))}
          </ul>
        </Container>
      </section>

      {/* How it works for this product */}
      <section aria-labelledby="steps" className="border-t border-line bg-surface py-14 sm:py-20">
        <Container>
          <h2 id="steps" className="text-2xl font-semibold tracking-tight text-ink">How it works</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {product.steps.map((s, i) => (
              <li key={s.title} className="border-t border-ink/80 pt-5">
                <p className="text-sm tabular-nums text-muted">Step {i + 1}</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Options and price */}
      <section aria-labelledby="price" className="border-t border-line py-14 sm:py-20">
        <Container className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 id="price" className="text-2xl font-semibold tracking-tight text-ink">Price</h2>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-ink">{product.priceLabel}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{product.priceNote}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Delivery {rupees(productPricing.deliveryFee)}, free above {rupees(productPricing.freeDeliveryAbove)}. Free rewrite within 24 hours.
            </p>
          </div>
          {product.styles ? (
            <div>
              <h3 className="text-sm font-medium text-ink">Paper options</h3>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {product.styles.map((s) => (
                  <li key={s.id} className="py-3.5">
                    <p className="text-[15px] font-medium text-ink">{s.name}</p>
                    <p className="text-sm text-muted">{s.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-medium text-ink">Notebook options</h3>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                <li className="py-3.5"><p className="text-[15px] font-medium text-ink">Ruled notebook</p><p className="text-sm text-muted">Single-ruled with a margin, 100 pages. B5, A5 or A4.</p></li>
                <li className="py-3.5"><p className="text-[15px] font-medium text-ink">Plain notebook</p><p className="text-sm text-muted">Unruled, 100 pages, good for diagrams. B5, A5 or A4.</p></li>
                <li className="py-3.5"><p className="text-[15px] font-medium text-ink">Loose A4 sheets</p><p className="text-sm text-muted">For notes you'll file or bind yourself.</p></li>
              </ul>
            </div>
          )}
        </Container>
      </section>

      {/* Product FAQ */}
      <section aria-labelledby="pfaq" className="border-t border-line bg-surface py-14 sm:py-20">
        <Container className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
          <h2 id="pfaq" className="text-2xl font-semibold tracking-tight text-ink">Questions about {product.name}</h2>
          <dl className="space-y-6">
            {product.faqs.map((f) => (
              <div key={f.q}>
                <dt className="text-[15px] font-medium text-ink">{f.q}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Other products */}
      <section aria-labelledby="more" className="border-t border-line py-14 sm:py-20">
        <Container>
          <h2 id="more" className="text-2xl font-semibold tracking-tight text-ink">We also write</h2>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {others.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/products/${p.slug}/`}
                  className="group flex flex-col gap-1 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <span>
                    <span className="text-[15px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">{p.name}</span>
                    <span className="block text-sm text-muted">{p.summary}</span>
                  </span>
                  <span className="text-sm tabular-nums text-muted">{p.priceLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}
