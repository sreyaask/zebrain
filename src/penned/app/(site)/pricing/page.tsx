import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";
import { Container, PageHeader } from "@/components/ui/Section";
import { PriceCalculator } from "@/components/PriceCalculator";
import { pricing } from "@/lib/mock";
import { rupees } from "@/lib/format";

export const metadata: Metadata = { title: "Pricing" };

const rows = [
  { item: "Notebook pages", detail: "Plain or ruled notebook, 100 pages each", price: `${rupees(pricing.perPage)} per page`, note: `${pricing.notebookMinimumPages}-page minimum` },
  { item: "Loose A4 sheets", detail: "Letters, assignments, forms", price: `${rupees(pricing.perPage)} per page`, note: "No minimum" },
  { item: "Premium cards", detail: "300 gsm A6 card with envelope", price: `${rupees(pricing.perPremiumCard)} per card`, note: "No minimum" },
  { item: "Delivery", detail: "Anywhere in our Hyderabad areas", price: `${rupees(pricing.deliveryFee)} flat`, note: `Free above ${rupees(pricing.freeDeliveryAbove)}` },
];

const included = [
  "Paper, pen and ink",
  "Blue or black, gel or ballpoint",
  "Layout editor with live preview",
  "Live page-by-page tracking",
  `Free rewrite of any page within ${pricing.rewriteWindowHours} hours`,
];

export default function PricingPage() {
  return (
    <Container className="max-w-4xl">
      <PageHeader title="Pricing" body="You pay per handwritten page or card. Paper and ink are included, and you see the exact total before paying." />

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-[15px]">
          <caption className="sr-only">Penned prices</caption>
          <thead className="border-b border-line bg-paper text-xs text-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium sm:px-6">Item</th>
              <th scope="col" className="px-5 py-3 font-medium sm:px-6">Price</th>
              <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell sm:px-6">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.item}>
                <th scope="row" className="px-5 py-4 font-normal sm:px-6">
                  <span className="font-medium text-ink">{r.item}</span>
                  <span className="block text-sm text-muted">{r.detail}</span>
                  <span className="mt-1 block text-sm text-muted sm:hidden">{r.note}</span>
                </th>
                <td className="whitespace-nowrap px-5 py-4 align-top font-medium tabular-nums sm:px-6">{r.price}</td>
                <td className="hidden px-5 py-4 align-top text-muted sm:table-cell sm:px-6">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
            <LinkButton href="/order">Start an order</LinkButton>
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
