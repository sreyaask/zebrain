import type { Glyph, GlyphSet, PlotPage, Stroke } from "./types.ts";

/** Physical page and ruling, in millimetres. */
export interface PageSpec {
  widthMm: number;
  heightMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  topMm: number; // y of the first rule (or first baseline area on plain paper)
  bottomMm: number;
  linePitchMm: number; // distance between rules / baselines
  xHeightMm: number;
}

export interface LayoutOptions {
  headingStyle: "underline" | "larger" | "plain";
  /** Seed for natural variation; use the order code so re-runs match. */
  seed: string;
  /** Variation strength, 0 = mechanical, 1 = default. */
  variation?: number;
}

export interface LayoutResult {
  pages: PlotPage[];
  missing: string[];
  lines: number;
}

/** Notebook geometry matching the customer-facing layout editor (lib/pricing.ts). */
export function pageSpecFor(size: { widthMm: number; heightMm: number }, marginMm: number, lineSpacing: number): PageSpec {
  const pitch = 7.2 * lineSpacing;
  return {
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    marginLeftMm: marginMm,
    marginRightMm: marginMm,
    topMm: pitch * 2,
    bottomMm: 12,
    linePitchMm: pitch,
    xHeightMm: 2.6,
  };
}

/** Characters we can draw without a sample, built from simple strokes (x-height units). */
const SYNTHETIC: Record<string, Stroke[]> = {
  "-": [[{ x: 0.05, y: 0.5 }, { x: 0.55, y: 0.5 }]],
  ":": [[{ x: 0.1, y: 0.75 }, { x: 0.13, y: 0.72 }], [{ x: 0.1, y: 0.05 }, { x: 0.13, y: 0.02 }]],
  ";": [[{ x: 0.12, y: 0.75 }, { x: 0.15, y: 0.72 }], [{ x: 0.14, y: 0.08 }, { x: 0.06, y: -0.25 }]],
  "'": [[{ x: 0.1, y: 1.55 }, { x: 0.07, y: 1.2 }]],
  '"': [[{ x: 0.08, y: 1.55 }, { x: 0.05, y: 1.2 }], [{ x: 0.28, y: 1.55 }, { x: 0.25, y: 1.2 }]],
  "/": [[{ x: 0.0, y: -0.2 }, { x: 0.55, y: 1.5 }]],
  "*": [[{ x: 0.25, y: 1.3 }, { x: 0.25, y: 0.7 }], [{ x: 0.0, y: 1.15 }, { x: 0.5, y: 0.85 }], [{ x: 0.0, y: 0.85 }, { x: 0.5, y: 1.15 }]],
};

/** Typographic look-alikes mapped to characters on the sample sheet. */
const ALIASES: Record<string, string> = {
  "–": "−", "—": "−", "‘": "'", "’": "'", "“": '"', "”": '"', "×": "x", "…": ".",
};

function makePrng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Resolver {
  get(ch: string): Glyph[] | null;
}

function resolver(set: GlyphSet): Resolver {
  const cache = new Map<string, Glyph[] | null>();
  return {
    get(ch) {
      if (cache.has(ch)) return cache.get(ch)!;
      let out: Glyph[] | null = set.glyphs[ch]?.length ? set.glyphs[ch] : null;
      if (!out && ALIASES[ch]) out = set.glyphs[ALIASES[ch]]?.length ? set.glyphs[ALIASES[ch]] : null;
      if (!out && (ch === "-" || ALIASES[ch] === "−") && set.glyphs["−"]?.length) out = set.glyphs["−"];
      if (!out) {
        const key = SYNTHETIC[ch] ? ch : ALIASES[ch] && SYNTHETIC[ALIASES[ch]] ? ALIASES[ch] : null;
        if (key) {
          const strokes = SYNTHETIC[key];
          const pts = strokes.flat();
          out = [{ char: ch, strokes, width: Math.max(...pts.map((p) => p.x)) + 0.05, top: Math.max(...pts.map((p) => p.y)), bottom: Math.min(...pts.map((p) => p.y)) }];
        }
      }
      cache.set(ch, out);
      return out;
    },
  };
}

const TRACKING = 0.22; // gap between letters, in x-heights
const SPACE = 0.75; // word space, in x-heights

function avgWidth(g: Glyph[]): number {
  return g.reduce((s, x) => s + x.width, 0) / g.length;
}

/**
 * Lay out text as handwriting on notebook pages.
 * This is the "A4 → notebook" step: any source text is re-flowed to the target page,
 * margins and ruling, then drawn with the customer's glyphs.
 */
export function layoutHandwriting(text: string, set: GlyphSet, spec: PageSpec, opts: LayoutOptions): LayoutResult {
  const rnd = makePrng(opts.seed);
  const v = opts.variation ?? 1;
  const jit = (amount: number) => (rnd() * 2 - 1) * amount * v;
  const glyphs = resolver(set);
  const missing = new Set<string>();
  const usable = spec.widthMm - spec.marginLeftMm - spec.marginRightMm;
  const linesPerPage = Math.max(1, Math.floor((spec.heightMm - spec.topMm - spec.bottomMm) / spec.linePitchMm) + 1);

  // 1) Break the text into visual lines.
  type VLine = { words: string[]; scale: number; heading: boolean };
  const vlines: VLine[] = [];
  const measure = (word: string, scale: number) =>
    Array.from(word).reduce((w, ch) => {
      const g = glyphs.get(ch);
      return w + ((g ? avgWidth(g) : 0.6) + TRACKING) * spec.xHeightMm * scale;
    }, 0);

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = raw.startsWith("# ");
    const scale = heading && opts.headingStyle === "larger" ? 1.3 : 1;
    const words = (heading ? raw.slice(2) : raw).split(/[ \t]+/).filter(Boolean);
    if (!words.length) {
      vlines.push({ words: [], scale, heading: false });
      continue;
    }
    let cur: string[] = [];
    let width = 0;
    const space = SPACE * spec.xHeightMm * scale;
    for (let word of words) {
      // Words longer than a whole line are broken by characters.
      while (measure(word, scale) > usable) {
        let cut = word.length - 1;
        while (cut > 1 && measure(word.slice(0, cut), scale) > usable) cut--;
        if (cur.length) vlines.push({ words: cur, scale, heading });
        vlines.push({ words: [word.slice(0, cut)], scale, heading });
        cur = [];
        width = 0;
        word = word.slice(cut);
      }
      const w = measure(word, scale);
      if (cur.length && width + space + w > usable) {
        vlines.push({ words: cur, scale, heading });
        cur = [];
        width = 0;
      }
      width += (cur.length ? space : 0) + w;
      cur.push(word);
    }
    if (cur.length) vlines.push({ words: cur, scale, heading });
  }
  // Drop trailing blank lines.
  while (vlines.length && !vlines[vlines.length - 1].words.length) vlines.pop();

  // 2) Draw each line.
  const pages: PlotPage[] = [];
  const lastSample = new Map<string, number>();
  vlines.forEach((line, i) => {
    const pageIdx = Math.floor(i / linesPerPage);
    const row = i % linesPerPage;
    if (!pages[pageIdx]) pages[pageIdx] = { widthMm: spec.widthMm, heightMm: spec.heightMm, strokes: [] };
    const page = pages[pageIdx];
    const baseline = spec.topMm + row * spec.linePitchMm - 0.35 + jit(0.25);
    const lineSlope = jit(0.004); // the whole line drifts very slightly
    let x = spec.marginLeftMm + jit(0.6);
    const startX = x;

    line.words.forEach((word, wi) => {
      if (wi > 0) x += SPACE * spec.xHeightMm * line.scale * (1 + jit(0.15));
      for (const ch of Array.from(word)) {
        const samples = glyphs.get(ch);
        if (!samples) {
          missing.add(ch);
          x += 0.6 * spec.xHeightMm * line.scale;
          continue;
        }
        // Pick a different sample from last time for natural variation.
        let pick = Math.floor(rnd() * samples.length);
        if (samples.length > 1 && pick === lastSample.get(ch)) pick = (pick + 1) % samples.length;
        lastSample.set(ch, pick);
        const g = samples[pick];
        const s = spec.xHeightMm * line.scale * (1 + jit(0.04));
        const shear = jit(0.04);
        const dy = jit(0.12);
        for (const stroke of g.strokes) {
          page.strokes.push(
            stroke.map((p) => {
              const px = x + (p.x + p.y * shear) * s;
              return { x: round(px), y: round(baseline + dy + (px - startX) * lineSlope - p.y * s) };
            }),
          );
        }
        x += (g.width + TRACKING * (1 + jit(0.2))) * s;
      }
    });

    if (line.heading && opts.headingStyle === "underline" && x > startX) {
      const uy = baseline + 0.9;
      page.strokes.push([
        { x: round(startX), y: round(uy + jit(0.15)) },
        { x: round((startX + x) / 2), y: round(uy + jit(0.2)) },
        { x: round(x - 0.5), y: round(uy + jit(0.15)) },
      ]);
    }
  });

  return { pages, missing: Array.from(missing), lines: vlines.length };
}

const round = (n: number) => Math.round(n * 100) / 100;
