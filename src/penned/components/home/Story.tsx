import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { segments } from "@/lib/segments";

/**
 * The "handwriting AI company" story, from Penned's infographic: the four layers of technology, the machine, why it isn't a
 * Xerox shop, and what only Penned does. Shared by the home page and /technology.
 */

export function Card({ children, className, tone = "plain" }: { children: ReactNode; className?: string; tone?: "plain" | "outline" | "copper" }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 sm:p-6",
        tone === "plain" && "border-line bg-surface",
        tone === "outline" && "border-accent/50 bg-surface",
        tone === "copper" && "border-accent-deep bg-accent-deep text-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Num({ n }: { n: number }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-deep text-sm font-medium text-white" aria-hidden="true">
      {n}
    </span>
  );
}

/** The idea in one line, set in a handwriting font on a dark ruled strip. */
export function HandwritingStrip({ text = "A machine wrote this page, in my own handwriting." }: { text?: string }) {
  return (
    <figure>
      <div
        className="rounded-xl border border-line bg-surface px-6 py-5 sm:px-8"
        style={{ backgroundImage: "linear-gradient(to bottom, transparent 47px, #2A2826 47px)", backgroundSize: "100% 48px" }}
      >
        <p className="font-hand text-[30px] leading-[48px] text-ink sm:text-[38px]">{text}</p>
      </div>
      <figcaption className="mt-2 text-xs text-muted">Illustration of the idea, set in a handwriting font.</figcaption>
    </figure>
  );
}

export const layers = [
  {
    title: "Handwriting cloning",
    body: "You write one sample sentence. AI learns your letter shapes, spacing and slant.",
    more: "Every letter is traced into pen strokes, with several versions of each, so no two words look copied and pasted.",
  },
  {
    title: "Notes reading",
    body: "You upload a photo of your notes. AI reads the text and the layout, and you can rearrange it.",
    more: "Every word, heading, numbered question, equation and table, in order. Diagrams are redrawn as clean drawings the pen can follow.",
  },
  {
    title: "Machine control",
    body: "Software turns every page into pen strokes and sends the job to the machines automatically.",
    more: "Pages are laid out at your notebook's real size, so the preview, the price and the written page all match line for line.",
  },
  {
    title: "Writing machines",
    body: "Robotic pen arms write each line with a real ink pen. The pages are then delivered to your door.",
    more: "Real ink on real paper: you can feel the pressure of each stroke. Every page is checked by a person before it leaves.",
  },
];

export function FourLayers({ detailed = false }: { detailed?: boolean }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2">
      {layers.map((l, i) => (
        <li key={l.title}>
          <Card className="h-full">
            <div className="flex items-center gap-3">
              <Num n={i + 1} />
              <h3 className="text-lg font-medium text-ink">{l.title}</h3>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{l.body}</p>
            {detailed && <p className="mt-3 text-[15px] leading-relaxed text-muted">{l.more}</p>}
          </Card>
        </li>
      ))}
    </ol>
  );
}

/** Five pen arms over a sheet that feeds through, like a printer. */
export function MachineIllustration() {
  const arms = [0, 1, 2, 3, 4];
  return (
    <Card className="px-4 sm:px-8">
      <svg viewBox="0 0 640 190" className="w-full" role="img" aria-label="Five pen arms above a sheet of paper, all writing the same line; arrows show the paper feeding through">
        <line x1="120" y1="22" x2="520" y2="22" stroke="#F2EFEA" strokeWidth="3" strokeLinecap="round" />
        <path d="M60 70v70m0 0l-12-12m12 12l12-12M580 70v70m0 0l-12-12m12 12l12-12" stroke="#F2EFEA" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="130" y="72" width="380" height="96" rx="6" fill="#F4EFE7" />
        <line x1="150" y1="128" x2="490" y2="128" stroke="#CBD5E8" strokeWidth="1.5" />
        <line x1="150" y1="150" x2="490" y2="150" stroke="#CBD5E8" strokeWidth="1.5" />
        {arms.map((i) => {
          const x = 170 + i * 75;
          return (
            <g key={i}>
              <line x1={x} y1="22" x2={x} y2="40" stroke="#F2EFEA" strokeWidth="2" />
              <path d={`M${x} 40l12 14-12 16-12-16z`} fill="#070707" stroke="#F2EFEA" strokeWidth="2" strokeLinejoin="round" />
              <path d={`M${x - 22} 102q6-8 11 0t11 0 11 0 11 0`} stroke="#C88660" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex justify-between gap-4 text-xs text-muted">
        <span>Five pen arms write the same line together</span>
        <span className="text-right">The paper feeds through, like a printer</span>
      </div>
    </Card>
  );
}

export function MachineSection() {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="machine-title" className="font-display text-[28px] font-light lowercase leading-tight tracking-tight text-ink sm:text-[34px]">
          the machine is built for handwriting
        </h2>
        <span className="rounded-full border border-ink/60 px-2.5 py-0.5 text-xs text-ink">In development</span>
      </div>
      <div className="mt-6">
        <MachineIllustration />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="text-lg font-medium text-ink">A copier</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">Fuses toner onto paper. It can only repeat a picture of a page that already exists.</p>
        </Card>
        <Card>
          <h3 className="text-lg font-medium text-ink">An ordinary pen plotter</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">One pen travels across the whole sheet, so a full page of writing takes a long time.</p>
        </Card>
        <Card tone="copper">
          <h3 className="text-lg font-medium">The Penned machine</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-white/85">
            Small pen arms share each line while the paper moves. Real pens, with only ink used up. Target: about one minute a page.
          </p>
        </Card>
      </div>
    </div>
  );
}

const xerox = [
  ["What you get", "A copy of a page that already exists", "New pages in your own handwriting"],
  ["Made with", "Toner from a copier", "Real pen ink on paper"],
  ["Technology", "A machine bought off the shelf", "Its own AI, software and machine design"],
  ["How you order", "Walk in and wait at the counter", "Upload from your phone, delivered home"],
];

export function XeroxTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
        <caption className="sr-only">How Penned compares with a Xerox shop</caption>
        <thead>
          <tr className="bg-accent-deep text-white">
            <th scope="col" className="px-5 py-3 font-medium"><span className="sr-only">Compared</span></th>
            <th scope="col" className="px-5 py-3 font-medium">Xerox shop</th>
            <th scope="col" className="px-5 py-3 font-medium">Penned</th>
          </tr>
        </thead>
        <tbody>
          {xerox.map(([k, a, b]) => (
            <tr key={k} className="border-t border-line">
              <th scope="row" className="bg-paper px-5 py-4 font-medium text-ink">{k}</th>
              <td className="bg-paper px-5 py-4 text-muted">{a}</td>
              <td className="bg-surface px-5 py-4 font-medium text-ink">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuickCommerce() {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-lg font-medium text-ink">Kirana store <span aria-hidden="true">→</span><span className="sr-only"> compared with </span> Blinkit, Zepto</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            They sell the same groceries a kirana store sells. An app, dark stores and logistics software made them tech companies.
          </p>
        </Card>
        <Card tone="outline">
          <h3 className="text-lg font-medium text-ink">Xerox shop <span aria-hidden="true">→</span><span className="sr-only"> compared with </span> Penned</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Not even the same product. A Xerox shop copies pages that exist. Penned writes new ones in your handwriting.
          </p>
        </Card>
      </div>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink">
        If anything, Blinkit is closer to a kirana store than Penned is to a Xerox shop.
      </p>
    </div>
  );
}

export function OnlyPenned() {
  const points = [
    "Clones your own handwriting with AI",
    "Writes with a real pen and real ink",
    "Its own machine, with pens writing together",
    "Software and machine built as one system",
  ];
  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {points.map((p) => (
          <li key={p} className="rounded-xl border border-accent/50 bg-surface px-5 py-4 text-[17px] font-medium text-ink">{p}</li>
        ))}
      </ul>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="font-medium text-ink">Tesla</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">Builds its own cars and the software that runs them.</p>
        </Card>
        <Card>
          <h3 className="font-medium text-ink">Apple</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">Designs iOS and the iPhone together, so each is made for the other.</p>
        </Card>
        <Card tone="copper">
          <h3 className="font-medium">Penned</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-white/85">Builds its own handwriting AI and the machine that writes with it.</p>
        </Card>
      </div>
      <p className="mt-3 text-xs text-muted">The same approach, at a much earlier stage. Penned is not affiliated with any company named here.</p>
    </div>
  );
}

/** The app's AI, step by step: photo → every word and diagram read → laid out at your notebook's size → written. */
export function AiPipeline() {
  const steps = [
    { title: "Snap your pages", body: "Photos or a PDF in the Penned app. Each page is read in seconds, several at a time." },
    { title: "AI reads everything", body: "Exact words, headings, numbered questions, equations and tables, in order. Diagrams are redrawn as clean drawings." },
    { title: "Formatted at your notebook's size", body: "Every line placed where the pen will write it, so you see the real pages and the exact page count before you pay." },
    { title: "A real pen writes it", body: "In your handwriting, diagrams included, then delivered to your door." },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-xl border border-line bg-surface p-5">
            <Num n={i + 1} />
            <div>
              <h3 className="font-medium text-ink">{s.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <ReadingIllustration />
    </div>
  );
}

/** A photo of messy notes on the left, the formatted notebook page on the right. */
function ReadingIllustration() {
  return (
    <Card className="p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-3" role="img" aria-label="A tilted photo of handwritten notes on the left becomes a neatly formatted notebook page with a heading, numbered questions and a circuit diagram on the right">
        <div className="relative aspect-[3/4] rotate-[-2deg] rounded-md bg-[#E9E2D6] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)]" aria-hidden="true">
          <p className="font-hand text-[13px] leading-[19px] text-[#2B3A80] sm:text-[15px] sm:leading-[22px]">
            <span className="underline">Electricity</span>
            <br />Q1. State Ohm&apos;s law.
            <br />Q2. A wire of 4 Ω carries
            <br />0.5 A. Find the p.d.
            <br />Q3. Draw the circuit…
          </p>
          <svg viewBox="0 0 120 50" className="mx-auto mt-2 w-[72%] rotate-[-3deg]">
            <path d="M10 13H36M43 11H66l3-6 5 11 5-10 5 10 5-11 3 6H109V41H11V13" stroke="#2B3A80" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M38 4v17M43 7v9" stroke="#2B3A80" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
        <div
          className="relative aspect-[3/4] rounded-md bg-sheet p-3"
          style={{ backgroundImage: "linear-gradient(to bottom, transparent 21px, #CBD5E8 21px)", backgroundSize: "100% 22px", backgroundPosition: "0 10px" }}
          aria-hidden="true"
        >
          <p className="pl-2 font-hand text-[13px] leading-[22px] text-pen-blue sm:text-[15px]">
            <span className="underline">Electricity</span>
            <br />Q1. State Ohm&apos;s law.
            <br />Q2. A wire of resistance 4 Ω
            <br />&nbsp;&nbsp;&nbsp;&nbsp;carries a current of 0.5 A.
          </p>
          <svg viewBox="0 0 120 50" className="mx-auto mt-1 w-[70%]">
            <path d="M10 12H36M43 12H66l3-5 5 10 5-10 5 10 5-10 3 5H110V42H10V12" stroke="#1A1A1A" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
            <path d="M38 4v16M43 8v8" stroke="#1A1A1A" strokeWidth="1.6" />
          </svg>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {["heading", "numbered questions", "equation", "diagram redrawn", "exact page count"].map((t) => (
          <span key={t} className="rounded-full border border-accent/50 px-2.5 py-1 text-accent">{t}</span>
        ))}
      </div>
    </Card>
  );
}

export function SegmentsGrid({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {segments.map((s) => (
        <li key={s.id}>
          <Link
            href={`/business/#${s.id}`}
            className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">{s.name}</p>
            <h3 className="mt-2 text-lg font-medium text-ink">{s.headline}</h3>
            {!compact && <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>}
            <p className="mt-4 rounded-lg bg-sheet px-3 py-2 font-hand text-[20px] leading-snug text-pen-blue" aria-hidden="true">{s.sample}</p>
            <span className="mt-auto pt-4 text-sm text-accent group-hover:underline group-hover:underline-offset-4">
              See how it works <span aria-hidden="true">→</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
