"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Three small motion graphics for "How it works". They play once, in order, when the section
 * scrolls into view, so each step visibly leads into the next. Paused until visible; with reduced
 * motion the final frame shows immediately (see globals.css).
 */
export function useInViewOnce<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, seen };
}

const a = (name: string, ms: number, delay: number, extra = ""): CSSProperties => ({
  animation: `${name} ${ms}ms cubic-bezier(.2,.7,.2,1) ${delay}ms both ${extra}`.trim(),
});

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="relative h-36 overflow-hidden rounded-xl border border-line bg-surface" role="img" aria-label={label}>
      {children}
    </div>
  );
}

/** 1. Camera guides lock onto a handwritten sample, then a scan line sweeps down. */
export function ScanGraphic({ delay = 0 }: { delay?: number }) {
  return (
    <Frame label="A phone camera scanning a handwritten sample sentence">
      <div className="absolute inset-x-6 inset-y-5 rounded-md bg-sheet shadow-[0_0_0_1px_#2A2826]">
        <p className="px-3 pt-3 font-hand text-[19px] leading-[26px] text-pen-blue">
          The quick brown fox
          <br />
          jumps over the lazy dog.
        </p>
        {/* corner guides */}
        {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((c) => (
          <span key={c} data-anim className={`absolute h-4 w-4 rounded-[3px] border-accent ${c}`} style={a("guide-in", 380, delay)} />
        ))}
        <span data-anim className="sg-scan absolute inset-x-1 h-[2px] rounded-full bg-accent" style={a("scan-sweep", 1100, delay + 400)} />
      </div>
      <span data-anim className="absolute bottom-2 right-3 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-success shadow-[0_0_0_1px_#2A2826]" style={a("pop-in", 260, delay + 1550)}>
        91 characters learned
      </span>
    </Frame>
  );
}

/** 2. A printed A4 page is re-written into a notebook, line by line. */
export function ReflowGraphic({ delay = 0 }: { delay?: number }) {
  const lines = ["Newton's Second Law:", "F = ma, where m is", "mass and a is accel..."];
  return (
    <Frame label="Printed text from an A4 page being rewritten by hand in a notebook">
      <div className="absolute bottom-5 left-5 top-5 w-[34%] rounded-md bg-sheet p-2 shadow-[0_0_0_1px_#E6E3DC]">
        {[90, 75, 85, 60, 80, 70].map((w, i) => (
          <span key={i} data-anim className="mb-1.5 block h-1.5 rounded-full bg-sheet-ink/20" style={{ width: `${w}%`, ...a("fade-dim", 300, delay + 250 + i * 120) }} />
        ))}
      </div>
      <svg data-anim className="absolute left-[41%] top-1/2 h-4 w-6 -translate-y-1/2 text-muted" viewBox="0 0 24 16" fill="none" style={a("pop-in", 260, delay + 150)} aria-hidden="true">
        <path d="M2 8h18m-5-5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div
        className="absolute bottom-5 right-5 top-5 w-[46%] rounded-md bg-sheet pl-4 pt-1 shadow-[0_0_0_1px_#E6E3DC]"
        style={{ backgroundImage: "linear-gradient(to bottom, transparent 23px, #CBD5E8 23px)", backgroundSize: "100% 24px" }}
      >
        {lines.map((l, i) => (
          <p key={l} data-anim className="whitespace-nowrap font-hand text-[15px] leading-[24px] text-pen-blue" style={a("write", 700, delay + 500 + i * 650, "")}>
            {l}
          </p>
        ))}
      </div>
    </Frame>
  );
}

/** 3. The pen machine writes a line, then the order is on its way. */
export function WriteGraphic({ delay = 0 }: { delay?: number }) {
  return (
    <Frame label="A pen machine writing a line by hand, then the order marked as delivered within 2 to 3 hours">
      <div className="absolute inset-x-4 inset-y-3 rounded-md bg-sheet" aria-hidden="true" />
      <div className="absolute inset-x-5 top-5 h-[3px] rounded-full bg-sheet-ink/10" aria-hidden="true" />
      <div className="absolute left-7 top-12">
        <span className="relative inline-block">
          <span data-anim className="whitespace-nowrap font-hand text-[26px] leading-none text-pen-blue" style={{ animation: `write 1300ms linear ${delay + 200}ms both` }}>
            With love,
          </span>
          <span data-anim className="sg-pen absolute -top-9 block" style={{ animation: `pen-move 1300ms linear ${delay + 200}ms both` }}>
            <span className="flex -translate-x-1/2 flex-col items-center">
              <span className="block h-4 w-5 rounded-[3px] bg-sheet-ink" />
              <span className="block h-5 w-[3px] bg-sheet-ink/70" />
              <span className="block h-1.5 w-1.5 rounded-full bg-pen-blue" />
            </span>
          </span>
        </span>
      </div>
      <div className="absolute inset-x-5 top-[84px] h-px bg-[#CBD5E8]" aria-hidden="true" />
      <span data-anim className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink shadow-[0_0_0_1px_#2A2826]" style={a("pop-in", 260, delay + 1650)}>
        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
        Delivered · 2–3 hrs
      </span>
    </Frame>
  );
}

/** The three "How it works" steps, each with its graphic. Graphics play in sequence once visible. */
export function HowItWorksSteps({ steps }: { steps: { n: string; title: string; body: string }[] }) {
  const { ref, seen } = useInViewOnce<HTMLOListElement>();
  const graphics = [<ScanGraphic key="s" delay={0} />, <ReflowGraphic key="r" delay={1500} />, <WriteGraphic key="w" delay={3400} />];
  return (
    <ol ref={ref} className="sg mt-10 grid gap-10 md:grid-cols-3 md:gap-8" data-play={seen ? "true" : "false"}>
      {steps.map((s, i) => (
        <li key={s.n}>
          {graphics[i]}
          <p className="mt-5 text-sm tabular-nums text-muted">Step {s.n}</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{s.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
