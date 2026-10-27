"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/lib/models";
import { useReducedMotion } from "./Motion";

// Examples from the launch script: each one types itself into the box and carries its template into the wizard.
const EXAMPLES = ["sql", "support", "tutor"].map((id) => TEMPLATES.find((t) => t.id === id)!);

// Ideas the empty box types out, one after another, until the visitor starts typing.
const IDEAS = [
  "A support bot for my shoe store that answers in English and Hindi.",
  "Turn plain-English questions into PostgreSQL queries.",
  "A maths tutor that explains every step like a patient teacher.",
  "Pull the name, date and total out of any invoice, as JSON.",
  "A study buddy that knows my college's syllabus inside out.",
];

// Types, holds, deletes and moves on to the next idea. Stops while `paused`.
function useTypedIdeas(paused: boolean) {
  const reduced = useReducedMotion();
  const [text, setText] = useState("");
  const state = useRef({ idea: 0, pos: 0, deleting: false });
  useEffect(() => {
    if (paused) return;
    if (reduced) return setText(IDEAS[0]);
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const s = state.current;
      const full = IDEAS[s.idea];
      if (!s.deleting) {
        s.pos++;
        setText(full.slice(0, s.pos));
        if (s.pos >= full.length) { s.deleting = true; t = setTimeout(tick, 1700); return; }
        t = setTimeout(tick, 28 + Math.random() * 40);
      } else {
        s.pos = Math.max(0, s.pos - 2);
        setText(full.slice(0, s.pos));
        if (s.pos === 0) { s.deleting = false; s.idea = (s.idea + 1) % IDEAS.length; t = setTimeout(tick, 350); return; }
        t = setTimeout(tick, 14);
      }
    };
    t = setTimeout(tick, 900);
    return () => clearTimeout(t);
  }, [paused, reduced]);
  return text;
}

export default function DescribeForm() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [text, setText] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const idea = useTypedIdeas(focused || text.length > 0);

  useEffect(() => () => { if (typing.current) clearTimeout(typing.current); }, []);

  function go() {
    if (!text.trim() || sending) return;
    const q = new URLSearchParams();
    q.set("d", text.trim());
    if (template) q.set("t", template);
    setSending(true);
    // Let the arrow launch before the page changes (instantly with reduced motion).
    setTimeout(() => router.push(`/new?${q.toString()}`), reduced ? 0 : 380);
  }

  // An example types itself in, quickly, so it's clear it went into the box.
  function fillExample(id: string, description: string) {
    if (typing.current) clearTimeout(typing.current);
    setTemplate(id);
    area.current?.focus();
    if (reduced) return setText(description);
    let i = 0;
    const step = () => {
      i = Math.min(description.length, i + 3);
      setText(description.slice(0, i));
      if (i < description.length) typing.current = setTimeout(step, 12);
    };
    step();
  }

  const empty = text.length === 0;
  return (
    <form onSubmit={(e) => { e.preventDefault(); go(); }} className="w-full max-w-xl text-left">
      <label htmlFor="describe" className="mb-2 block text-sm text-paper/80">What should your model do?</label>
      <div className="zb-shell" data-filled={!empty} data-sending={sending}>
        <div className="relative rounded-[20px] bg-black/70 backdrop-blur-md">
          {empty && !focused && (
            <p aria-hidden="true" className="pointer-events-none absolute left-4 right-16 top-3 text-base leading-relaxed text-paper/45">
              {idea}<span className="zb-caret" />
            </p>
          )}
          <textarea
            ref={area}
            id="describe"
            rows={3}
            className="block w-full resize-none rounded-[20px] bg-transparent px-4 pb-14 pt-3 text-base leading-relaxed text-paper placeholder:text-paper/40 focus:outline-none"
            value={text}
            placeholder={focused ? "Describe the job in a sentence or two" : ""}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => { setText(e.target.value); setTemplate(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } }}
            aria-describedby="describe-hint"
          />
          <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-3">
            <span id="describe-hint" className="pl-1 text-xs text-paper/40">
              {empty ? "Plain English is perfect" : <>Press <kbd className="font-mono">⌘/Ctrl + Enter</kbd> to start</>}
            </span>
            <button
              type="submit"
              disabled={empty || sending}
              data-sending={sending}
              aria-label={sending ? "Starting" : "Start building"}
              className="zb-send relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white disabled:bg-white/10 disabled:text-paper/40"
            >
              <svg className="zb-arrow h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              <svg className="zb-ring absolute inset-0 h-11 w-11" viewBox="0 0 44 44" aria-hidden="true">
                <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeDasharray="30 90" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
        <span className="mr-1 text-sm text-paper/55">Try</span>
        {EXAMPLES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={template === t.id}
            onClick={() => fillExample(t.id, t.description)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${template === t.id ? "border-accent bg-accent/15 text-paper" : "border-white/15 text-paper/70 hover:border-white/40 hover:text-paper"}`}
          >
            {t.name}
          </button>
        ))}
      </div>
    </form>
  );
}
