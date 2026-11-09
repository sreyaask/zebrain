import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Section";
import { PenMachineHero } from "@/components/home/PenMachineHero";
import { HowItWorksSteps } from "@/components/home/StepGraphics";
import { Faq } from "@/components/home/Faq";
import { ProductCard } from "@/components/products/ProductCard";
import { PriceList } from "@/components/products/PriceList";
import { products, sampleReviews } from "@/lib/mock";

const steps = [
  {
    n: "1",
    title: "Write one sample sentence",
    body: "Copy our short sample (one sentence with every letter, plus capitals and numbers) on paper and take a photo. Our AI learns how you write each character.",
  },
  {
    n: "2",
    title: "Upload or type what you want written",
    body: "Notes, a letter, a guest list, a recipe book. Choose the paper, ink and layout, with a live preview.",
  },
  {
    n: "3",
    title: "A real pen writes it",
    body: "A pen machine writes every page in your handwriting, on real paper. Delivered in Hyderabad in 2–3 hours.",
  },
];

const reasons = [
  {
    title: "It feels personal",
    body: "People keep handwritten notes and cards. They read like they came from you, because they're in your hand.",
  },
  {
    title: "Real ink, not print",
    body: "A real gel or ballpoint pen on real paper. You can see the pressure of each stroke and feel the ink.",
  },
  {
    title: "Unique to you",
    body: "Your letters, your slant, your spacing. Each letter varies a little, so nothing looks copied and pasted.",
  },
];

export default function HomePage() {
  const [notes, ...others] = products;
  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <Container className="grid items-center gap-12 py-12 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <h1 className="text-[40px] font-semibold leading-[1.05] tracking-tight text-ink [text-wrap:balance] sm:text-6xl">
              Handwritten notes, ready to study from.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink">
              Penned makes neat, handwritten copies of your notes so you can revise from a clean notebook, catch up after absences, or keep a
              tidy record of lessons.
            </p>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">
              Written with a real pen in your handwriting, and delivered across Hyderabad in 2–3 hours. We also write letters, cards and
              invitations.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/order/" size="lg">
                Get started
              </LinkButton>
              <LinkButton href="/#products" size="lg" variant="secondary">
                See what we write
              </LinkButton>
            </div>
            <p className="mt-5 text-sm text-muted">Notes from ₹11 a page. Free rewrite of any page within 24 hours.</p>
          </div>
          <PenMachineHero />
        </Container>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-it-works-title" className="scroll-mt-16 py-16 sm:py-24" id="how-it-works">
        <Container>
          <SectionHeading id="how-it-works-title" title="How it works" body="Set up your handwriting once. After that, every order takes a couple of minutes." />
          <HowItWorksSteps steps={steps} />
        </Container>
      </section>

      {/* Products */}
      <section aria-labelledby="products-title" id="products" className="scroll-mt-16 border-y border-line bg-surface py-16 sm:py-24">
        <Container>
          <SectionHeading
            id="products-title"
            title="What we write"
            body="Notes are our main service. We also write letters, cards, invitations and more by hand."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ProductCard product={notes} featured />
            </div>
            {others.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </Container>
      </section>

      {/* Why handwritten */}
      <section aria-labelledby="why-title" className="py-16 sm:py-24">
        <Container>
          <SectionHeading id="why-title" title="Why handwritten" />
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {reasons.map((r) => (
              <div key={r.title}>
                <h3 className="text-lg font-semibold text-ink">{r.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{r.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Pricing */}
      <section aria-labelledby="pricing-title" className="border-t border-line py-16 sm:py-24">
        <Container>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <SectionHeading id="pricing-title" title="Pricing" body="Each product has its own rate. Paper and ink are always included, and you see the exact total before you pay." />
            <Link href="/pricing/" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              Full pricing and calculator
            </Link>
          </div>
          <div className="mt-8">
            <PriceList />
          </div>
        </Container>
      </section>

      {/* Reviews (placeholders) */}
      <section aria-labelledby="reviews-title" className="border-t border-line bg-surface py-16 sm:py-24">
        <Container>
          <SectionHeading id="reviews-title" title="What customers say" />
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {sampleReviews.map((r, i) => (
              <li key={i} className="rounded-xl border border-dashed border-ink/25 bg-paper p-5">
                <p className="inline-block rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
                  Sample review — replace before launch
                </p>
                <blockquote className="mt-4 text-[15px] leading-relaxed text-muted">{r.quote.replace("Sample review — replace before launch. ", "")}</blockquote>
                <p className="mt-4 text-sm text-ink">
                  {r.name}
                  <span className="block text-muted">{r.context}</span>
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="border-t border-line py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading id="faq" title="Questions" />
          <Faq />
        </Container>
      </section>

      {/* Final call to action */}
      <section className="border-t border-line bg-surface py-16 sm:py-20">
        <Container className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Write once. We&apos;ll handle the rest.</h2>
            <p className="mt-2 text-[15px] text-muted">Set up your handwriting in two minutes, then order whatever you need.</p>
          </div>
          <LinkButton href="/order/" size="lg">
            Get started
          </LinkButton>
        </Container>
      </section>
    </>
  );
}
