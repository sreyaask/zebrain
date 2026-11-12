import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Section";
import { Card } from "@/components/home/Story";
import { EnquiryForm } from "@/components/business/EnquiryForm";
import { productPricing } from "@/lib/mock";
import { segments } from "@/lib/segments";

export const metadata: Metadata = {
  title: "For business",
  description:
    "Handwritten letters and cards at scale for authors, schools, NGOs, banks and brands. Written with a real pen in your own handwriting by Penned's AI and machines.",
};

const steps = [
  {
    title: "One person writes a sample",
    body: "The author, principal, founder or relationship manager copies one short sample sheet and gives written consent. Our AI learns their handwriting from it.",
  },
  {
    title: "Send your message and your list",
    body: "Upload a spreadsheet of names and details and write the message once. Each card gets its own name, amount or date filled in. You approve a preview first.",
  },
  {
    title: "Our machines write every card",
    body: "Each one is written with a real pen on real card, checked by a person, and delivered to you in Hyderabad ready to post or hand out.",
  },
];

const wont = [
  "Signatures on cheques, contracts, forms or anything that authorises money or a legal step",
  "Anyone's handwriting without that person's written consent",
  "Students' work, exam answers or anything handed in for marks",
  "Notes made to look like they came from someone who didn't approve them",
];

export default function BusinessPage() {
  const b = productPricing.businessMail;
  const tiers = [
    { range: `Up to ${b.tiers[0].min - 1}`, price: b.perNote },
    { range: `${b.tiers[0].min} to ${b.tiers[1].min - 1}`, price: b.tiers[0].price },
    { range: `${b.tiers[1].min} or more`, price: b.tiers[1].price },
  ];
  return (
    <>
      <section className="border-b border-line">
        <Container className="py-12 sm:py-20">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Penned for business</p>
          <h1 className="mt-5 max-w-4xl font-display text-[40px] font-light lowercase leading-[1.05] tracking-tight text-ink [text-wrap:balance] sm:text-[60px]">
            handwritten mail, <span className="block text-accent">at the scale of print.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink">
            People open a handwritten envelope and keep what&apos;s inside. Penned writes hundreds of letters and cards in one person&apos;s real
            handwriting, each with its own name and details, using a real pen.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="#enquiry" size="lg">
              Request samples
            </LinkButton>
            <LinkButton href="#prices" size="lg" variant="secondary">
              See prices
            </LinkButton>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2 text-sm">
            {segments.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-block rounded-full border border-line px-3 py-1.5 text-muted transition-colors hover:border-accent/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="who-title" className="py-16 sm:py-24">
        <Container>
          <SectionHeading id="who-title" title="who we write for" body="The same four layers of technology behind our notes, pointed at the mail your organisation already sends." />
          <div className="mt-10 space-y-4">
            {segments.map((s) => (
              <article key={s.id} id={s.id} className="scroll-mt-20 rounded-xl border border-line bg-surface p-5 sm:p-8">
                <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">{s.name}</p>
                    <h3 className="mt-2 font-display text-2xl font-light tracking-tight text-ink sm:text-[28px]">{s.headline}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
                    {s.safeguard && (
                      <p className="mt-4 border-l-2 border-accent/60 pl-3 text-sm leading-relaxed text-muted">{s.safeguard}</p>
                    )}
                  </div>
                  <div>
                    <p className="rounded-lg bg-sheet px-4 py-3 font-hand text-[24px] leading-snug text-pen-blue" aria-hidden="true">
                      {s.sample}
                    </p>
                    <ul className="mt-4 space-y-2 text-[15px] text-ink">
                      {s.uses.map((u) => (
                        <li key={u} className="flex gap-3">
                          <svg className="mt-1 h-4 w-4 shrink-0 text-accent" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {u}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="how-title" className="border-t border-line py-16 sm:py-24">
        <Container>
          <SectionHeading id="how-title" title="how it works" />
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Card className="h-full">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-deep text-sm font-medium text-white" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-medium text-ink">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="prices-title" id="prices" className="scroll-mt-16 border-t border-line py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading id="prices-title" title="prices" body="For a handwritten note card with envelope. Longer letters and special paper are quoted with your order." />
            <div className="mt-8 overflow-hidden rounded-xl border border-line">
              <table className="w-full border-collapse text-left text-[15px]">
                <caption className="sr-only">Price per handwritten card by quantity</caption>
                <thead>
                  <tr className="bg-accent-deep text-white">
                    <th scope="col" className="px-5 py-3 font-medium">Cards in one order</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Each</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => (
                    <tr key={t.range} className="border-t border-line bg-surface">
                      <td className="px-5 py-4 text-ink">{t.range}</td>
                      <td className="px-5 py-4 text-right font-medium tabular-nums text-ink">₹{t.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted">Estimates. Card, envelope, pen and ink are included, and we confirm your quote before we write.</p>
          </div>
          <div>
            <SectionHeading title="what we won't write" body="Handwriting carries trust, so we keep a short list of rules." />
            <ul className="mt-8 space-y-3">
              {wont.map((w) => (
                <li key={w} className="flex gap-3 rounded-xl border border-line bg-surface px-5 py-4 text-[15px] leading-relaxed text-ink">
                  <svg className="mt-1 h-4 w-4 shrink-0 text-danger" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section aria-labelledby="enquiry-title" id="enquiry" className="scroll-mt-16 border-t border-line py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <SectionHeading
            id="enquiry-title"
            title="see it on your own card"
            body="Tell us what you send today. We'll write a few sample cards with your message and reply with a quote."
          />
          <EnquiryForm />
        </Container>
      </section>
    </>
  );
}
