import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Section";
import { HowItWorksSteps } from "@/components/home/StepGraphics";
import { AiPipeline, Card, FourLayers, HandwritingStrip, MachineSection, OnlyPenned, XeroxTable } from "@/components/home/Story";

export const metadata: Metadata = {
  title: "Technology",
  description:
    "The four layers behind every Penned page: handwriting cloning, notes reading, machine control and writing machines that use a real pen.",
};

const steps = [
  {
    n: "1",
    title: "Write one sample sentence",
    body: "Copy our short sample (one sentence with every letter, plus capitals and numbers) on paper and take a photo. Our AI learns how you write each character.",
  },
  {
    n: "2",
    title: "Upload or type what you want written",
    body: "Notes, a letter, a guest list, a recipe book. The AI reads it and lays it out for your paper, with a live preview.",
  },
  {
    n: "3",
    title: "A real pen writes it",
    body: "A pen machine writes every page in your handwriting, on real paper, and we deliver it in Hyderabad.",
  },
];

const oneLayout = [
  { title: "The preview", body: "You see each notebook page as it will be written: the same lines, margins and words on every line." },
  { title: "The price", body: "The page count comes from that same layout, so the total you see is for the pages the pen will actually write." },
  { title: "The pen", body: "The machine receives the same layout as pen strokes, in your handwriting, with diagrams and tables drawn in place." },
];

export default function TechnologyPage() {
  return (
    <>
      <section className="border-b border-line">
        <Container className="py-12 sm:py-20">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Technology</p>
          <h1 className="mt-5 max-w-4xl font-display text-[40px] font-light lowercase leading-[1.05] tracking-tight text-ink [text-wrap:balance] sm:text-[60px]">
            four layers between <span className="block text-accent">your phone and the pen.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink">
            Penned is AI that learns handwriting and reads notes, software that turns pages into pen strokes, and machines that write them in real
            ink. Built to work as one system.
          </p>
          <div className="mt-10">
            <HandwritingStrip />
          </div>
        </Container>
      </section>

      <section aria-labelledby="layers-title" className="py-16 sm:py-24">
        <Container>
          <SectionHeading id="layers-title" title="the four layers" body="Every page goes through all four before a pen touches paper." />
          <div className="mt-8">
            <FourLayers detailed />
          </div>
        </Container>
      </section>

      <section aria-labelledby="reading-title" className="border-y border-line bg-surface/40 py-16 sm:py-24">
        <Container>
          <SectionHeading
            id="reading-title"
            eyebrow="Layer 2, up close"
            title="notes reading"
            body="A photo of a notebook page is tilted, shadowed and full of abbreviations. The AI copies it out exactly, keeps its structure, and redraws what isn't text."
          />
          <div className="mt-10">
            <AiPipeline />
          </div>
        </Container>
      </section>

      <section aria-labelledby="one-title" className="py-16 sm:py-24">
        <Container>
          <SectionHeading
            id="one-title"
            eyebrow="Layer 3, up close"
            title="one layout for the preview, the price and the pen"
            body="Pages are laid out once, at the real measurements of your notebook. Everything else follows from that layout."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {oneLayout.map((o) => (
              <Card key={o.title}>
                <h3 className="text-lg font-medium text-ink">{o.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{o.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="machine-title" className="border-t border-line py-16 sm:py-24">
        <Container>
          <MachineSection />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Card>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-success">Running today</p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                Handwriting cloning, notes reading, page layout and machine control. Pages are written by single-pen machines with a real ink pen.
              </p>
            </Card>
            <Card tone="outline">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">In development</p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                Our own machine, with several pen arms sharing each line while the paper feeds through. Target: about one minute a page.
              </p>
            </Card>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
            Notes reading runs on Google&apos;s Gemini models. Handwriting cloning, page layout and machine control are Penned&apos;s own software.
          </p>
        </Container>
      </section>

      <section aria-labelledby="flow-title" className="border-t border-line py-16 sm:py-24">
        <Container>
          <SectionHeading id="flow-title" title="from one sample to a written page" body="Set up your handwriting once. After that, every order takes a couple of minutes." />
          <HowItWorksSteps steps={steps} />
        </Container>
      </section>

      <section aria-labelledby="xerox-title" className="border-t border-line py-16 sm:py-24">
        <Container>
          <SectionHeading id="xerox-title" title="why it isn't a xerox shop" />
          <div className="mt-8">
            <XeroxTable />
          </div>
          <div className="mt-16">
            <SectionHeading title="what only penned does" />
            <div className="mt-8">
              <OnlyPenned />
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t border-line py-16 sm:py-20">
        <Container className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-[28px] font-light leading-tight tracking-tight text-ink sm:text-[34px]">
              Your notes. Your handwriting. <span className="text-accent">Written by a machine.</span>
            </h2>
            <p className="mt-2 text-[15px] text-muted">Try it with a page of your own notes.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/order/" size="lg">
              Get started
            </LinkButton>
            <LinkButton href="/business/" size="lg" variant="secondary">
              For business
            </LinkButton>
          </div>
        </Container>
      </section>
    </>
  );
}
