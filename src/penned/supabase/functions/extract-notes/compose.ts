// Builds formatted SVG pages from Gemini's reading, at the measurements of the notebook we'll write in: headings,
// paragraphs, lists, equations and tables in reading order, with each diagram placed as Gemini's own SVG redrawing. These are the "formatted notes" the customer
// previews on the phone; the pen plotter later writes the same content in the customer's handwriting.
import { toOrder } from "./gemini.ts";
import type { Extraction } from "./gemini.ts";

const W = 1000; // page width in SVG units; the height follows the notebook

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Reads width/height from an SVG's viewBox (defaults to 1000×600). */
function viewBox(svg: string): { x: number; y: number; w: number; h: number; inner: string } {
  const vb = svg.match(/viewBox\s*=\s*"([\d.\-\s,]+)"/i)?.[1].trim().split(/[\s,]+/).map(Number);
  const x = vb && Number.isFinite(vb[0]) ? vb[0] : 0;
  const y = vb && Number.isFinite(vb[1]) ? vb[1] : 0;
  const w = vb && vb[2] > 0 ? vb[2] : 1000;
  const h = vb && vb[3] > 0 ? vb[3] : 600;
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
  return { x, y, w, h, inner };
}

/** The notebook the notes will be written in, in millimetres (same geometry as the plotter: lib/engine/layout.ts). */
export interface Notebook {
  widthMm: number;
  heightMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  topMm: number;
  bottomMm: number;
  linePitchMm: number;
  ruled: boolean;
}

/** Penned's new long notebook: 17.5 × 27.5 cm, 18 mm margins, lines 9.36 mm apart (7.2 mm × 1.3 house spacing). */
export const LONG_RULED: Notebook = {
  widthMm: 175, heightMm: 275, marginLeftMm: 18, marginRightMm: 18, topMm: 18.72, bottomMm: 12, linePitchMm: 9.36, ruled: true,
};

const num = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

/** A notebook from the app's request, checked; anything implausible falls back to the long ruled notebook. */
export function notebookFrom(v: unknown): Notebook {
  const n = (v ?? {}) as Record<string, unknown>;
  const w = num(n.width_mm, 50, 400), h = num(n.height_mm, 50, 500);
  if (!w || !h) return LONG_RULED;
  const pitch = num(n.line_pitch_mm, 3, 20) ?? LONG_RULED.linePitchMm;
  const margin = Math.min(num(n.margin_mm, 0, 60) ?? 18, w - 40);
  return {
    widthMm: w, heightMm: h, marginLeftMm: Math.max(0, margin), marginRightMm: num(n.margin_right_mm, 0, 60) ?? Math.min(18, margin),
    topMm: pitch * 2, bottomMm: 12, linePitchMm: pitch, ruled: n.ruled !== false,
  };
}

// The plotter's handwriting (lib/engine/layout.ts): x-height 2.6 mm, about 2.3 mm a character with its spacing, word
// spaces 0.75 x-heights, two leading spaces = 6 mm indent, wrapped lines of "Q1." / "(a)" / "-" hang under the text,
// diagrams at 0.13 mm per drawing unit (shrunk to fit), baselines 0.35 mm above the ruled line.
const CHAR_MM = 2.3, SPACE_MM = 1.95, INDENT_MM = 6, BASELINE_MM = 0.35;
const MARKER = /^(Q?\d+[.)]|\(?[a-z]{1,3}\)|[a-z][.)]|[-•*–])$/i;
const DIAGRAM = /^\[\[diagram:([\w-]+)\]\]$/;

/**
 * The notebook pages exactly as the pen will write them: the same order text the plotter gets, laid out with the
 * plotter's rules (lines per page, word wrapping, indents, headings underlined, blank lines, diagram sizes and page
 * breaks) at the notebook's real measurements. Text is typeset (the pen uses the customer's handwriting), so the words
 * on each line, the lines on each page and the number of pages match what is written.
 */
export function composeOrder(text: string, svgs: Record<string, string>, nb: Notebook = LONG_RULED): string[] {
  const k = W / nb.widthMm;                       // SVG units per mm
  const pageH = Math.round(nb.heightMm * k);
  const pitch = nb.linePitchMm;
  const usable = nb.widthMm - nb.marginLeftMm - nb.marginRightMm;
  const perPage = Math.max(1, Math.floor((nb.heightMm - nb.topMm - nb.bottomMm) / pitch) + 1);
  const xh = Math.min(2.6, pitch * 0.36);
  const charMm = CHAR_MM * (xh / 2.6), spaceMm = SPACE_MM * (xh / 2.6);
  const font = (charMm / 0.52) * k;               // a font whose average character is as wide as the pen's

  const pages: string[][] = [];
  let pageIdx = 0, row = 0;
  const page = () => (pages[pageIdx] ??= []);
  const mm = (v: number) => (v * k).toFixed(1);

  for (const raw of text.replace(/\r\n?/g, "\n").replace(/\s+$/, "").split("\n")) {
    const d = raw.trim().match(DIAGRAM);
    if (d) {
      const svg = svgs[d[1]];
      const vb = svg ? viewBox(svg) : null; // the same viewBox the plotter reads (cleanSvg already fitted it)
      if (!vb) {                                 // no drawing: the plotter leaves 4 lines for it
        if (row + 4 > perPage && row > 0) { pageIdx++; row = 0; }
        page();
        row += 4;
        continue;
      }
      const maxH = Math.max(pitch * 3, (perPage - 1) * pitch * 0.8);
      const scale = Math.min(0.13, usable / vb.w, maxH / vb.h);
      const w = vb.w * scale, h = vb.h * scale;
      const rows = Math.max(2, Math.ceil((h + pitch * 0.5) / pitch));
      if (row > 0 && row + rows > perPage) { pageIdx++; row = 0; }
      const x0 = nb.marginLeftMm + (usable - w) / 2;
      const y0 = nb.topMm + row * pitch - pitch * 0.75;
      page().push(`<svg x="${mm(x0)}" y="${mm(y0)}" width="${mm(w)}" height="${mm(h)}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet">${vb.inner}</svg>`);
      row += rows;
      continue;
    }
    const heading = raw.startsWith("# ");
    const words = (heading ? raw.slice(2) : raw).split(/[ \t]+/).filter(Boolean);
    if (!words.length) {                          // a blank line takes a row
      if (row >= perPage) { pageIdx++; row = 0; }
      row++;
      continue;
    }
    // Same wrapping as the plotter and the price estimate (lib/pricing.ts estimatePagesOn).
    const lead = heading ? 0 : (raw.match(/^ +/)?.[0].length ?? 0);
    const first = Math.min(Math.floor(lead / 2) * INDENT_MM, usable / 2);
    const hang = MARKER.test(words[0]) && words.length > 1 ? Math.min(words[0].length * charMm + spaceMm, usable / 3) : 0;
    const lines: { words: string[]; indent: number }[] = [];
    let cur: string[] = [], width = 0, indent = first;
    const flush = () => { lines.push({ words: cur, indent }); cur = []; width = 0; indent = first + hang; };
    for (let word of words) {
      while (word.length * charMm > usable - indent) {
        if (cur.length) flush();
        const fit = Math.max(1, Math.floor((usable - indent) / charMm));
        cur = [word.slice(0, fit)];
        flush();
        word = word.slice(fit);
      }
      if (!word) continue;
      const w = word.length * charMm;
      if (cur.length && width + spaceMm + w > usable - indent) flush();
      width += (cur.length ? spaceMm : 0) + w;
      cur.push(word);
    }
    if (cur.length) flush();
    for (const line of lines) {
      if (row >= perPage) { pageIdx++; row = 0; }
      const x = nb.marginLeftMm + line.indent;
      const y = nb.topMm + row * pitch - BASELINE_MM;
      const t = line.words.join(" ");
      page().push(`<text x="${mm(x)}" y="${mm(y)}" font-size="${font.toFixed(1)}" textLength="${mm(Math.min(usable - line.indent, t.length * charMm))}" lengthAdjust="spacingAndGlyphs">${esc(t)}</text>`);
      if (heading) {
        const len = t.length * charMm;
        page().push(`<line x1="${mm(x)}" y1="${mm(y + 0.9)}" x2="${mm(x + len)}" y2="${mm(y + 0.9)}" stroke="#1b2f8a" stroke-width="2.5"/>`);
      }
      row++;
    }
  }

  const ruling = nb.ruled
    ? Array.from({ length: perPage }, (_, r) => `<line x1="0" y1="${mm(nb.topMm + r * pitch)}" x2="${W}" y2="${mm(nb.topMm + r * pitch)}" stroke="#c9d6ee" stroke-width="1.5"/>`).join("") +
      (nb.marginLeftMm > 5 ? `<line x1="${mm(nb.marginLeftMm - 3)}" y1="0" x2="${mm(nb.marginLeftMm - 3)}" y2="${pageH}" stroke="#e6a7a7" stroke-width="1.5"/>` : "")
    : "";
  const out: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const content = pages[i] ?? [];
    out.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${pageH}" width="${W}" height="${pageH}">` +
      `<rect width="${W}" height="${pageH}" fill="white"/>${ruling}` +
      `<g font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" fill="#1b2f8a">${content.join("")}</g></svg>`,
    );
  }
  return out;
}

/** Formatted pages straight from Gemini's reading (builds the order text first, as the pen gets it). */
export function composeLayout(x: Extraction, nb: Notebook = LONG_RULED): string[] {
  const order = toOrder(x);
  return composeOrder(order.text, Object.fromEntries(order.diagrams.map((d) => [d.id, d.svg])), nb);
}
