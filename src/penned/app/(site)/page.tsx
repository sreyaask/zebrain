import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Section";
import { NotebookHero } from "@/components/home/NotebookHero";
import { EarlyList } from "@/components/home/EarlyList";
import { Faq } from "@/components/home/Faq";
import { pricing, useCases } from "@/lib/mock";
import { rupees } from "@/lib/format";

const steps = [
  {
    n: "01",
    title: "Scan your handwriting",
    body: "Write three short lines on paper and photograph them. We learn each of your letters, its slant and its spacing.",
  },
  {
    n: "02",
    title: "Upload what to write",
    body: "Photos or a PDF of the pages to copy, or just type and paste. Adjust margins, spacing and ink before you pay.",
  },
  {
    n: "03",
    title: "We write & deliver",
    body: "A trained writer copies it with a real pen in your style. A rider brings it to your door in 2–3 hours.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-24">
          <div className="animate-slide-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Opening soon in Hyderabad
            </p>
            <h1 className="mt-6 text-[40px] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Your handwriting.
              <br />
              Written for you.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
              Notes, letters and cards written with a real pen and real ink, in a style cloned from your own hand.
              Delivered anywhere in our Hyderabad areas in 2–3 hours.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/order" size="lg">
                Start an order
              </LinkButton>
              <LinkButton href="/setup" size="lg" variant="secondary">
                Set up your handwriting
              </LinkButton>
            </div>
            <p className="mt-5 text-sm text-muted">
              From {rupees(pricing.perPage)} a page. Free rewrite of any page within 24 hours.
            </p>
          </div>
          <NotebookHero />
        </Container>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-it-works-title" className="scroll-mt-16 py-20 sm:py-24" id="how-it-works">
        <Container>
            <SectionHeading
              id="how-it-works-title"
              title="Three steps, then it's at your door"
              body="Set up your handwriting once. After that, every order takes about two minutes to place."
            />
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((s) => (
              <li key={s.n} className="border-t border-ink/80 pt-5">
                <p className="text-sm tabular-nums text-muted">{s.n}</p>
                <h3 className="mt-3 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Use cases */}
      <section aria-labelledby="use-cases" className="border-y border-line bg-surface py-20 sm:py-24">
        <Container>
            <SectionHeading
              id="use-cases"
              title="Anything you'd write by hand, if you had the time"
            />
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {useCases.map((u) => (
                <div key={u.title} className="flex h-full flex-col justify-between rounded-xl border border-line bg-paper p-6">
                  <p className="font-hand text-[28px] leading-tight text-pen-blue" aria-hidden="true">
                    {u.sample}
                  </p>
                  <div className="mt-10">
                    <h3 className="text-base font-semibold text-ink">{u.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{u.body}</p>
                  </div>
                </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Pricing teaser */}
      <section aria-labelledby="pricing-teaser" className="py-20 sm:py-24">
        <Container>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <SectionHeading
                id="pricing-teaser"
                title="Priced per page. Nothing hidden."
                body="Paper and ink are included. You see the exact total before you pay."
              />
            <Link href="/pricing" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              See full pricing
            </Link>
          </div>
          <dl className="mt-10 divide-y divide-line border-y border-line">
            {[
              { price: rupees(pricing.perPage), unit: "per page", body: `Notebooks and loose A4. ${pricing.notebookMinimumPages}-page minimum for notebooks.` },
              { price: rupees(pricing.perPremiumCard), unit: "per card", body: "Premium 300 gsm A6 card with envelope." },
              { price: rupees(pricing.deliveryFee), unit: "delivery", body: `Flat fee. Free on orders above ${rupees(pricing.freeDeliveryAbove)}.` },
            ].map((p) => (
              <div key={p.unit} className="grid gap-1 py-5 sm:grid-cols-[180px_1fr] sm:items-baseline">
                <dt className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                  {p.price}
                  <span className="ml-1.5 text-sm font-normal text-muted">{p.unit}</span>
                </dt>
                <dd className="text-[15px] leading-relaxed text-muted">{p.body}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="border-t border-line py-20 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <SectionHeading id="faq" title="Before you order" />
            <Faq />
        </Container>
      </section>

      {/* Early list */}
      <section aria-labelledby="early-list" className="border-t border-line bg-surface py-20 sm:py-24">
        <Container className="grid items-start gap-10 lg:grid-cols-2">
            <SectionHeading
              id="early-list"
              title="Join the early list"
              body="We're opening area by area, starting with Kondapur, Gachibowli and Madhapur. Leave your email and we'll tell you the day Penned reaches you."
            />
            <EarlyList />
        </Container>
      </section>
    </>
  );
}
