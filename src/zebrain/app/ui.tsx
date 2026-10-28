"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { play, useSounds } from "@/lib/sound";
import { useReducedMotion } from "./Motion";

// Line icons (24px grid, stroke = currentColor), kept inline so they never flash in.
const PATHS: Record<string, string> = {
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  headset: "M4 14v-2a8 8 0 0116 0v2M4 14a2 2 0 012-2h1v6H6a2 2 0 01-2-2v-2zM20 14a2 2 0 00-2-2h-1v6h1a2 2 0 002-2v-2zM17 18c0 1.7-2 3-5 3",
  school: "M2 9l10-5 10 5-10 5L2 9zM6 11v5c2 2 10 2 12 0v-5M22 9v6",
  pen: "M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4zM13.5 6.5l4 4",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  chat: "M4 5h16v11H8l-4 4V5z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z",
  rocket: "M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 15l-3-3c1-4 4.5-8.5 13-9-.5 8.5-5 12-9 13l-1-1zM14.5 9.5a1 1 0 100-2 1 1 0 000 2z",
  gift: "M4 11h16v9H4v-9zM3 7h18v4H3V7zM12 7v13M12 7c-2 0-4-1-4-2.5S10 2 12 7zm0 0c2 0 4-1 4-2.5S14 2 12 7z",
  cpu: "M7 7h10v10H7V7zM10 10h4v4h-4v-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
  help: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  x: "M6 6l12 12M18 6L6 18",
  bolt: "M13 3L5 14h6l-1 7 8-11h-6l1-7z",
  smile: "M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 14a4.5 4.5 0 007 0M9 9.5h.01M15 9.5h.01",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  briefcase: "M4 8h16v11H4V8zM9 8V5h6v3M4 13h16",
  volume: "M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11",
  mute: "M4 10v4h4l5 4V6L8 10H4zM16 10l5 5M21 10l-5 5",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  file: "M6 3h8l5 5v13H6V3zM14 3v5h5",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z",
  refresh: "M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3M7.5 14h9",
  inbox: "M4 13l2.5-8h11l2.5 8v6H4v-6zM4 13h5l1 2h4l1-2h5",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export type Choice<T extends string> = {
  value: T;
  title: string;
  desc?: React.ReactNode;
  icon?: IconName;
  meta?: React.ReactNode; // badges along the bottom (size, speed…)
  aside?: React.ReactNode; // top right, e.g. a price
  off?: string; // why it can't be picked right now
  flag?: string; // a small highlight, e.g. "Recommended"
};

// One choice from a set of large cards. A real radio group: one tab stop, arrow keys move and pick.
export function CardGroup<T extends string>({ label, options, value, onChange, cols = "sm:grid-cols-2 lg:grid-cols-3" }: {
  label: string; options: Choice<T>[]; value: T | null; onChange: (v: T) => void; cols?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const live = options.filter((o) => !o.off);
  const focusable = options.some((o) => o.value === value && !o.off) ? value : live[0]?.value;
  function move(from: number, dir: 1 | -1) {
    for (let n = 1; n <= options.length; n++) {
      const i = (from + dir * n + options.length) % options.length;
      if (!options[i].off) {
        refs.current[i]?.focus();
        pick(options[i].value);
        return;
      }
    }
  }
  function pick(v: T) {
    if (v !== value) play("click");
    onChange(v);
  }
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-3 ${cols}`}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={!!o.off}
            tabIndex={o.value === focusable ? 0 : -1}
            onClick={() => !o.off && pick(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i, 1); }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i, -1); }
            }}
            className="card"
          >
            {on && <span className="card-tick" aria-hidden="true"><Icon name="check" className="h-3.5 w-3.5" /></span>}
            <span className="flex items-start gap-3 pr-6">
              {o.icon && <span className="card-icon"><Icon name={o.icon} /></span>}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[17px] font-medium leading-snug">{o.title}</span>
                  {o.aside && <span className="text-sm tabular-nums text-paper">{o.aside}</span>}
                </span>
                {o.flag && <span className="badge badge-on mt-1">{o.flag}</span>}
              </span>
            </span>
            {o.desc && <span className="block text-sm text-mute">{o.desc}</span>}
            {o.meta && <span className="mt-auto flex flex-wrap gap-1.5 pt-1">{o.meta}</span>}
            {o.off && <span className="block text-sm text-paper">{o.off}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />;
}

// A friendly error with a way out. Plays the error sound once per new message.
export function ErrorNote({ message, onRetry, retryLabel = "Try again", children }: {
  message: string; onRetry?: () => void; retryLabel?: string; children?: React.ReactNode;
}) {
  useEffect(() => {
    if (message) play("error");
  }, [message]);
  if (!message) return null;
  return (
    <div role="alert" className="zb-bubble flex flex-wrap items-start gap-3 rounded-2xl border border-bad/40 bg-bad/[0.07] p-4 text-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bad/15 text-bad"><Icon name="x" className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Something went wrong</p>
        <p className="mt-0.5 text-mute">{message}</p>
        {children}
      </div>
      {onRetry && (
        <button type="button" className="btn-ghost py-2" onClick={() => { play("click"); onRetry(); }}>
          <Icon name="refresh" className="h-4 w-4" /> {retryLabel}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, children, action }: { icon?: IconName; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-14 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent"><Icon name={icon} className="h-7 w-7" /></span>
      <h2 className="text-xl font-medium">{title}</h2>
      {children && <div className="mt-2 max-w-[46ch] text-sm text-mute">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// Floating buttons, bottom right: new project, help, and (where it applies) the page's main action.
export function Fabs({ help, primary }: {
  help: { title: string; body: React.ReactNode };
  primary?: { label: string; icon?: IconName; onClick: () => void; disabled?: boolean; hint?: string };
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const helpBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); helpBtn.current?.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div ref={panel} id={id} role="dialog" aria-label={help.title} tabIndex={-1}
          className="fab-in pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-5 text-sm shadow-2xl focus:outline-none">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-medium">{help.title}</h2>
            <button type="button" className="rounded-full p-1 text-mute hover:text-paper" aria-label="Close help" onClick={() => { setOpen(false); helpBtn.current?.focus(); }}>
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2 text-mute">{help.body}</div>
        </div>
      )}
      <div className="pointer-events-auto flex items-center gap-3">
        <Link href="/new" className="fab fab-in" aria-label="New project" title="New project" onClick={() => play("click")}>
          <Icon name="plus" />
        </Link>
        <button ref={helpBtn} type="button" className="fab fab-in" aria-label="Help" title="Help" aria-expanded={open} aria-controls={id}
          onClick={() => { play("click"); setOpen(!open); }}>
          <Icon name="help" />
        </button>
        {primary && (
          <button type="button" className="fab fab-primary fab-in" onClick={primary.onClick} disabled={primary.disabled} title={primary.hint}>
            <Icon name={primary.icon ?? "rocket"} /> <span className="hidden sm:inline">{primary.label}</span>
            <span className="sr-only sm:hidden">{primary.label}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// A burst of confetti from the top of the screen. Nothing with reduced motion.
export function Celebrate({ show }: { show: boolean }) {
  const reduced = useReducedMotion();
  const [pieces, setPieces] = useState<{ left: number; x: number; r: number; d: number; delay: number; c: string }[]>([]);
  useEffect(() => {
    if (!show || reduced) return;
    const colors = ["rgb(var(--accent))", "#a5d7ff", "#4ade80", "#facc15", "#f472b6", "#ffffff"];
    setPieces(Array.from({ length: 90 }, (_, i) => ({
      left: Math.random() * 100, x: (Math.random() - 0.5) * 260, r: 360 + Math.random() * 720,
      d: 2.2 + Math.random() * 1.6, delay: Math.random() * 0.5, c: colors[i % colors.length],
    })));
    const t = setTimeout(() => setPieces([]), 4500);
    return () => clearTimeout(t);
  }, [show, reduced]);
  return (
    <div aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="zb-confetti" style={{
          left: `${p.left}%`, background: p.c, animationDelay: `${p.delay}s`,
          ["--x" as string]: `${p.x}px`, ["--r" as string]: `${p.r}deg`, ["--d" as string]: `${p.d}s`,
        }} />
      ))}
    </div>
  );
}

export function SoundToggle() {
  const [on, set] = useSounds();
  return (
    <button type="button" onClick={() => set(!on)} aria-pressed={on} aria-label={on ? "Sounds on. Turn off" : "Sounds off. Turn on"} title={on ? "Mute sounds" : "Turn sounds on"}
      className="grid h-8 w-8 place-items-center rounded-full text-mute transition-colors hover:bg-line/60 hover:text-paper">
      <Icon name={on ? "volume" : "mute"} className="h-[18px] w-[18px]" />
    </button>
  );
}

// Dark is the default; light is saved in this browser. The <head> script in layout.tsx applies it before paint.
export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.dataset.theme === "light"), []);
  function flip() {
    const next = light ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("zebrain.theme", next);
    } catch {}
    setLight(!light);
    play("click");
  }
  return (
    <button type="button" onClick={flip} aria-label={light ? "Switch to dark theme" : "Switch to light theme"} title={light ? "Dark theme" : "Light theme"}
      className="grid h-8 w-8 place-items-center rounded-full text-mute transition-colors hover:bg-line/60 hover:text-paper">
      <Icon name={light ? "moon" : "sun"} className="h-[18px] w-[18px]" />
    </button>
  );
}
