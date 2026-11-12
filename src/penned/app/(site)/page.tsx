import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Section";
import { PenMachineHero } from "@/components/home/PenMachineHero";
import { Faq } from "@/components/home/Faq";
import { AiPipeline, FourLayers, HandwritingStrip, MachineSection, OnlyPenned, QuickCommerce, SegmentsGrid, XeroxTable } from "@/components/home/Story";
import { ProductCard } from "@/components/products/ProductCard";
import { PriceList } from "@/components/products/PriceList";
import { products, sampleReviews } from "@/lib/mock";

export default function HomePage() {
  const [notes, ...others] = products;
  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <Container className="grid items-center gap-12 py-12 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">ai &amp; robotic solutions</p>
            <h1 className="mt-5 font-display text-[44px] font-light lowercase leading-[1.04] tracking-tight text-ink [text-wrap:balance] sm:text-[68px]">
              not a print shop. <span className="text-accent">a handwriting ai company.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink">
              Every page goes through four layers of technology before a pen touches paper.
            </p>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
              Our AI learns your handwriting and reads your notes. Our machines write every page with a real pen, and we deliver it across
              Hyderabad.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/order/" size="lg">
                Get started
              </LinkButton>
              <LinkButton href="/technology/" size="lg" variant="secondary">
                See the technology
              </LinkButton>
            </div>
            <p className="mt-5 text-sm text-muted">
              Notes from ₹12 a page.{" "}
              <Link href="/business/" className="text-accent underline-offset-4 hover:underline">
                Writing for a school, NGO, bank or brand?
              </Link>
            </p>
          </div>
          <PenMachineHero />
        </Container>
      </section>

      {/* The idea */}
      <section className="py-12 sm:py-16">
        <Container>
          <HandwritingStrip />
        </Container>
      </section>

      {/* The four layers */}
      <section aria-labelledby="layers-title" id="how-it-works" className="scroll-mt-16 pb-16 sm:pb-24">
        <Container>
          <SectionHeading id="layers-title" title="the four layers" body="Two layers of AI, one of software and one of machines. Each page passes through all four." />
          <div className="mt-8">
            <FourLayers />
          </div>
        </Container>
      </section>

      {/* The AI in the app */}
      <section aria-labelledby="ai-title" className="border-y border-line bg-surface/40 py-16 sm:py-24">
        <Container>
          <SectionHeading
            id="ai-title"
            eyebrow="Inside the Penned app"
            title="ai that reads a page the way you do"
            body="Point your phone at a page of notes. In seconds you see it as it will be written: every word, every diagram, at the real size of your notebook."
          />
          <div className="mt-10">
            <AiPipeline />
          </div>
          <p className="mt-8">
            <Link href="/technology/" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              How the technology works <span aria-hidden="true">→</span>
            </Link>
          </p>
        </Container>
      </section>

      {/* The machine */}
      <section aria-labelledby="machine-title" className="py-16 sm:py-24">
        <Container>
          <MachineSection />
        </Container>
      </section>

      {/* Not a Xerox shop */}
      <section aria-labelledby="xerox-title" className="border-t border-line py-16 sm:py-24">
        <Container>
          <SectionHeading id="xerox-title" title="why it isn't a xerox shop" />
          <div className="mt-8">
            <XeroxTable />
          </div>
          <div className="mt-16">
            <SectionHeading title="the same logic as quick commerce" />
            <div className="mt-8">
              <QuickCommerce />
            </div>
          </div>
        </Container>
      </section>

      {/* What only Penned does */}
      <section aria-labelledby="only-title" className="border-t border-line py-16 sm:py-24">
        <Container>
          <SectionHeading id="only-title" title="what only penned does" />
          <div className="mt-8">
            <OnlyPenned />
          </div>
        </Container>
      </section>

      {/* Who we write for */}
      <section aria-labelledby="segments-title" id="for-business" className="scroll-mt-16 border-y border-line bg-surface/40 py-16 sm:py-24">
        <Container>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <SectionHeading
              id="segments-title"
              eyebrow="Beyond notes"
              title="handwriting for every organisation"
              body="Authors, schools, NGOs, banks and brands use the same technology to send letters and cards people keep."
            />
            <LinkButton href="/business/" variant="secondary">
              Penned for business
            </LinkButton>
          </div>
          <div className="mt-10">
            <SegmentsGrid compact />
          </div>
        </Container>
      </section>

      {/* Products */}
      <section aria-labelledby="products-title" id="products" className="scroll-mt-16 py-16 sm:py-24">
        <Container>
          <SectionHeading id="products-title" title="what we write" body="Notes are our main service. We also write letters, cards, invitations and more by hand." />
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

      {/* Pricing */}
      <section aria-labelledby="pricing-title" className="border-t border-line py-16 sm:py-24">
        <Container>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <SectionHeading id="pricing-title" title="pricing" body="Each product has its own rate. Paper and ink are always included, and you see the exact total before you pay." />
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
      <section aria-labelledby="reviews-title" className="border-t border-line py-16 sm:py-24">
        <Container>
          <SectionHeading id="reviews-title" title="what customers say" />
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {sampleReviews.map((r, i) => (
              <li key={i} className="rounded-xl border border-dashed border-ink/25 bg-surface p-5">
                <p className="inline-block rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-medium text-muted">
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
          <SectionHeading id="faq" title="questions" />
          <Faq />
        </Container>
      </section>

      {/* Final call to action */}
      <section className="border-t border-line py-16 sm:py-20">
        <Container className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-[28px] font-light leading-tight tracking-tight text-ink sm:text-[34px]">
              Your notes. Your handwriting. <span className="text-accent">Written by a machine.</span>
            </h2>
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
