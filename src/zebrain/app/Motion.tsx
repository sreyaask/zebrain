"use client";

import { useEffect, useRef, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

// True once the element has scrolled into view (and stays true).
export function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setInView(true), io.disconnect()), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

const GLYPHS = "▓▒░█#@%&01<>/";

// A pixel word that decodes from scrambled glyphs into place, left to right. Screen readers get the word itself.
export function Decode({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (reduced) return setShown(text);
    let frame = 0;
    let timer: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        frame++;
        const settled = Math.floor(frame / 3);
        setShown(text.split("").map((c, i) => (i < settled || c === " " ? c : GLYPHS[(frame * 7 + i * 13) % GLYPHS.length])).join(""));
        if (settled >= text.length) clearInterval(timer);
      }, 45);
    }, delay);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [text, delay, reduced]);
  return (
    <span className="pixel">
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

// Words that rise in one after another; `stagger` ms apart, starting after `delay`.
export function Rise({ words, delay = 0, stagger = 70 }: { words: (string | JSX.Element)[]; delay?: number; stagger?: number }) {
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="zb-word" style={{ animationDelay: `${delay + i * stagger}ms` }}>{w}</span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

// A model being made, line by line: the product explained by watching it. Loops while on screen, pauses off it,
// and shows the finished run at once with reduced motion.
const LOG: { tag: string; text: string; bar?: boolean; done?: boolean }[] = [
  { tag: "plan", text: "support bot · English + Hindi · 8 topics · Qwen3.5 4B" },
  { tag: "data", text: "AI read faq.pdf and wrote 2,250 checked examples" },
  { tag: "train", text: "step 420 of 420 · loss 0.41", bar: true },
  { tag: "test", text: "27 of 30 held-back questions right · identity ok" },
  { tag: "publish", text: "you/stepup-support-4b · v1" },
  { tag: "chat", text: "live on this site, with an API", done: true },
];

export function RunDemo() {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (reduced) return setStep(LOG.length);
    if (!visible) return;
    const wait = step === 0 ? 500 : step >= LOG.length ? 3200 : LOG[step - 1].bar ? 1900 : 900;
    const t = setTimeout(() => setStep((s) => (s >= LOG.length ? 0 : s + 1)), wait);
    return () => clearTimeout(t);
  }, [step, visible, reduced]);

  return (
    <div ref={box} className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/60 p-4 text-left font-mono text-[12.5px] leading-6 backdrop-blur-md sm:text-[13px]">
      <div className="mb-2 flex items-center justify-between text-paper/50">
        <span>zebrain run · stepup-support</span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${step >= LOG.length ? "bg-[#4ade80]" : "bg-accent"} ${step < LOG.length ? "animate-pulse" : ""}`} aria-hidden="true" />
          {step >= LOG.length ? "done" : "running"}
        </span>
      </div>
      <ol aria-label="Example run" className="space-y-0.5">
        {LOG.map((l, i) => (
          <li key={l.tag} className="zb-line" data-on={i < step}>
            <span className={l.done ? "text-[#4ade80]" : "text-accent"}>{l.done ? "✓" : "›"}</span>{" "}
            <span className="inline-block w-[4.6rem] text-paper/50">{l.tag}</span>
            <span className="text-paper/90">{l.text}</span>
            {l.bar && (
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <span className="zb-bar block h-full rounded-full bg-gradient-to-r from-accent to-[#a5d7ff]" />
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// Reveals its children when scrolled into view; `index` staggers siblings.
export function Reveal({ children, index = 0, className = "", as: Tag = "div" }: { children: React.ReactNode; index?: number; className?: string; as?: "div" | "li" }) {
  const [ref, inView] = useInView<HTMLDivElement & HTMLLIElement>(0.2);
  return (
    <Tag ref={ref} className={`zb-reveal ${className}`} data-in={inView} style={{ transitionDelay: `${index * 80}ms` }}>
      {children}
    </Tag>
  );
}

// The line joining the steps, drawn down as the list scrolls in.
export function Track() {
  const [ref, inView] = useInView<HTMLSpanElement>(0.1);
  return <span ref={ref} aria-hidden="true" data-in={inView} className="zb-track absolute bottom-6 left-[0.45rem] top-6 hidden w-px bg-gradient-to-b from-accent via-accent/40 to-transparent md:block" />;
}
