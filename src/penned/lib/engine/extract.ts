import type { Bitmap, Box, Glyph, GlyphSet, Stroke } from "./types.ts";
import { components, crop, merged, thin, type Component } from "./raster.ts";
import { traceSkeleton } from "./trace.ts";
import { DESCENDERS, SHEET_LINES, X_HEIGHT_CHARS, expectedChars } from "./sheet.ts";

/** A mark is one written character: one or more ink components (e.g. "i" = stem + dot). */
export interface Mark {
  comps: Component[];
  box: Box;
}

export interface LineReport {
  index: number;
  sheetLine: number; // which SHEET_LINES entry this written line was matched to
  expected: number;
  found: number;
  ok: boolean;
  note?: string;
}

export interface ExtractResult {
  glyphSet: GlyphSet;
  lines: LineReport[];
  missing: string[]; // characters with no usable sample
  /** Boxes of every mark with the character it was matched to, for the review overlay. */
  marks: { box: Box; char: string | null; line: number }[];
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Group components into written lines using their vertical centres. */
function groupLines(comps: Component[]): Component[][] {
  const heights = comps.map((c) => c.box.y1 - c.box.y0 + 1);
  const typical = Math.max(4, median(heights.filter((h) => h > 2)));
  const sorted = [...comps].sort((a, b) => a.box.y0 + a.box.y1 - (b.box.y0 + b.box.y1));
  const lines: { comps: Component[]; centre: number }[] = [];
  for (const c of sorted) {
    const centre = (c.box.y0 + c.box.y1) / 2;
    const line = lines.find((l) => Math.abs(l.centre - centre) < typical * 0.9);
    if (line) {
      line.comps.push(c);
      // Weight by the big strokes so dots/commas don't drag the centre.
      const big = line.comps.filter((x) => x.box.y1 - x.box.y0 + 1 >= typical * 0.5);
      line.centre = median((big.length ? big : line.comps).map((x) => (x.box.y0 + x.box.y1) / 2));
    } else lines.push({ comps: [c], centre });
  }
  return lines.sort((a, b) => a.centre - b.centre).map((l) => l.comps);
}

/** Merge components that overlap horizontally (i/j dots, "=", "%", "?", "!"). */
function toMarks(line: Component[]): Mark[] {
  const items = [...line].sort((a, b) => a.box.x0 - b.box.x0).map((c) => ({ comps: [c], box: c.box }));
  const marks: Mark[] = [];
  for (const it of items) {
    const prev = marks[marks.length - 1];
    if (prev) {
      const ov = Math.min(prev.box.x1, it.box.x1) - Math.max(prev.box.x0, it.box.x0) + 1;
      const narrow = Math.min(prev.box.x1 - prev.box.x0, it.box.x1 - it.box.x0) + 1;
      if (ov > 0 && ov >= narrow * 0.5) {
        prev.comps.push(...it.comps);
        prev.box = merged([prev.box, it.box]);
        continue;
      }
    }
    marks.push(it);
  }
  return marks;
}

/** Split the widest mark at its thinnest column (two touching letters). */
function splitWidest(bm: Bitmap, marks: Mark[]): boolean {
  const widths = marks.map((m) => m.box.x1 - m.box.x0 + 1);
  const typical = median(widths);
  let idx = -1, best = 0;
  widths.forEach((w, i) => {
    if (w > typical * 1.5 && w > best) {
      best = w;
      idx = i;
    }
  });
  if (idx < 0) return false;
  const m = marks[idx];
  const counts: number[] = [];
  for (let x = m.box.x0; x <= m.box.x1; x++) {
    let n = 0;
    for (let y = m.box.y0; y <= m.box.y1; y++) n += bm.data[y * bm.width + x];
    counts.push(n);
  }
  const lo = Math.floor(counts.length * 0.25), hi = Math.ceil(counts.length * 0.75);
  let cut = lo, min = Infinity;
  for (let i = lo; i < hi; i++) if (counts[i] < min) [min, cut] = [counts[i], i];
  const cx = m.box.x0 + cut;
  const left: number[] = [], right: number[] = [];
  for (const c of m.comps) for (const p of c.pixels) ((p % bm.width) < cx ? left : right).push(p);
  if (!left.length || !right.length) return false;
  // A loop, not Math.min(...spread): large marks have more pixels than the engine allows function arguments.
  const boxOf = (px: number[]): Box => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of px) {
      const x = p % bm.width, y = (p / bm.width) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return { x0, x1, y0, y1 };
  };
  const a: Component = { pixels: left, box: boxOf(left) }, b: Component = { pixels: right, box: boxOf(right) };
  marks.splice(idx, 1, { comps: [a], box: a.box }, { comps: [b], box: b.box });
  return true;
}

/** Merge the narrowest adjacent pair (a letter written in two pieces). */
function mergeNarrowest(marks: Mark[]): boolean {
  if (marks.length < 2) return false;
  let idx = 0, best = Infinity;
  for (let i = 0; i < marks.length - 1; i++) {
    const gap = marks[i + 1].box.x0 - marks[i].box.x1;
    const w = marks[i + 1].box.x1 - marks[i].box.x0;
    const score = w + gap * 2;
    if (score < best) [best, idx] = [score, i];
  }
  const a = marks[idx], b = marks[idx + 1];
  marks.splice(idx, 2, { comps: [...a.comps, ...b.comps], box: merged([a.box, b.box]) });
  return true;
}

/** Convert one mark into a glyph in x-height units relative to the line baseline. */
function markToGlyph(bm: Bitmap, mark: Mark, char: string, baseline: number, xh: number): Glyph | null {
  const { bitmap, box } = crop(bm, mark.comps);
  const skeleton = thin(bitmap);
  const px = traceSkeleton(skeleton, Math.max(0.6, xh / 40));
  if (!px.length) return null;
  const strokes: Stroke[] = px.map((s) =>
    s.map((p) => ({
      x: (p.x - 1) / xh, // crop has 1px padding
      y: (baseline - (p.y - 1 + box.y0)) / xh,
    })),
  );
  let top = -Infinity, bottom = Infinity;
  for (const s of strokes) for (const p of s) {
    if (p.y > top) top = p.y;
    if (p.y < bottom) bottom = p.y;
  }
  return {
    char,
    strokes,
    width: (box.x1 - box.x0 + 1) / xh,
    top,
    bottom,
  };
}

/**
 * Build a glyph set from a photographed sample sheet.
 * Written lines are matched to SHEET_LINES in order (repeating), so a sheet written
 * three times gives three samples of every character.
 */
export function extractGlyphs(bm: Bitmap): ExtractResult {
  const comps = components(bm);
  const lines = groupLines(comps);
  const reports: LineReport[] = [];
  const reviewMarks: ExtractResult["marks"] = [];
  const samples: { char: string; mark: Mark; line: number }[] = [];
  const lineMeta: { baseline: number; xh: number; line: number }[] = [];

  lines.forEach((line, i) => {
    const sheetLine = i % SHEET_LINES.length;
    const expected = expectedChars(SHEET_LINES[sheetLine]);
    const marks = toMarks(line);
    let guard = 0;
    while (marks.length < expected.length && guard++ < 40 && splitWidest(bm, marks));
    guard = 0;
    while (marks.length > expected.length && guard++ < 40 && mergeNarrowest(marks));
    const ok = marks.length === expected.length;
    reports.push({
      index: i,
      sheetLine,
      expected: expected.length,
      found: marks.length,
      ok,
      note: ok ? undefined : "Character count doesn't match the sheet line. This line was skipped.",
    });
    marks.forEach((m, k) => reviewMarks.push({ box: m.box, char: ok ? expected[k] : null, line: i }));
    if (!ok) return;

    // Baseline: median bottom of letters that sit on the line.
    const onLine = marks.filter((_, k) => !DESCENDERS.has(expected[k]) && !"-−=+%()'\"".includes(expected[k]));
    const baseline = median(onLine.map((m) => m.box.y1));
    const xhMarks = marks.filter((_, k) => X_HEIGHT_CHARS.has(expected[k]));
    const xh = xhMarks.length ? median(xhMarks.map((m) => m.box.y1 - m.box.y0 + 1)) : 0;
    lineMeta.push({ baseline, xh, line: i });
    marks.forEach((m, k) => samples.push({ char: expected[k], mark: m, line: i }));
  });

  // One x-height for the whole sheet (lines without lowercase borrow it).
  const xh = median(lineMeta.map((l) => l.xh).filter((v) => v > 0)) || 20;
  const glyphs: Record<string, Glyph[]> = {};
  for (const s of samples) {
    const meta = lineMeta.find((l) => l.line === s.line)!;
    const g = markToGlyph(bm, s.mark, s.char, meta.baseline, xh);
    if (g) (glyphs[s.char] ||= []).push(g);
  }

  const wanted = new Set(SHEET_LINES.flatMap((l) => expectedChars(l)));
  const missing = Array.from(wanted).filter((c) => !glyphs[c]?.length);

  return {
    glyphSet: { version: 1, glyphs, xHeightPx: xh, createdAt: new Date().toISOString() },
    lines: reports,
    missing,
    marks: reviewMarks,
  };
}
