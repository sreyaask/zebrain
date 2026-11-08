import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";
import { Container, PageHeader } from "@/components/ui/Section";
import { PriceCalculator } from "@/components/PriceCalculator";
import { PriceList } from "@/components/products/PriceList";

export const metadata: Metadata = { title: "Pricing" };

const included = [
  "Paper, envelopes, pen and ink",
  "Blue or black ink, gel or ballpoint",
  "A live preview before you pay",
  "Live tracking while we write",
  "Free rewrite of any page or card within 24 hours",
];

export default function PricingPage() {
  return (
    <Container className="max-w-4xl">
      <PageHeader title="Pricing" body="Each product has its own rate. You see the exact total before you pay, and business orders get a confirmed quote first." />
      <PriceList />
      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <section aria-labelledby="included">
          <h2 id="included" className="text-lg font-semibold">Always included</h2>
          <ul className="mt-4 space-y-3 text-[15px] text-muted">
            {included.map((i) => (
              <li key={i} className="flex gap-3">
                <svg className="mt-1 h-4 w-4 shrink-0 text-accent" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {i}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <LinkButton href="/order/">Get started</LinkButton>
          </div>
        </section>
        <section aria-labelledby="estimate">
          <h2 id="estimate" className="text-lg font-semibold">Estimate your order</h2>
          <PriceCalculator />
        </section>
      </div>
    </Container>
  );
}
