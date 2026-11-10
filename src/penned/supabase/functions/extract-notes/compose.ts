// Builds formatted SVG pages from Gemini's reading, at the measurements of the notebook we'll write in: headings,
// paragraphs, lists, equations and tables in reading order, with each diagram placed as Gemini's own SVG redrawing. These are the "formatted notes" the customer
// previews on the phone; the pen plotter later writes the same content in the customer's handwriting.
import { tighten } from "./gemini.ts";
import type { Extraction } from "./gemini.ts";

const W = 1000; // page width in SVG units; the height follows the notebook

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy word wrap using an average glyph width; good enough for a preview. */
function wrap(text: string, size: number, width: number): string[] {
  const max = Math.max(8, Math.floor(width / (size * 0.52)));
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if ((line ? line.length + 1 : 0) + word.length > max && line) {
        out.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    out.push(line);
  }
  return out;
}

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

/**
 * What we'll write, page by page, at the notebook's real measurements: the same page size, margins, line spacing and
 * letter size the plotter uses, so the words on each line and the lines on each page match what the pen writes. Each
 * written line sits on a ruled line; headings are bold and underlined; numbered questions stay at the margin, sub-parts
 * and bullets are indented; tables are grids on the lines; diagrams keep their share of the page width. Blocks keep the
 * original order and the writer's own line breaks; long lines wrap at the notebook's width; full pages continue.
 */
export function composeLayout(x: Extraction, nb: Notebook = LONG_RULED): string[] {
  const k = W / nb.widthMm;                       // SVG units per mm
  const pageH = Math.round(nb.heightMm * k);
  const pitch = nb.linePitchMm * k;
  const top = nb.topMm * k;
  const left = nb.marginLeftMm * k;
  const right = W - nb.marginRightMm * k;
  // The plotter's letters: x-height 2.6 mm (smaller on tight ruling), about 2.3 mm a character with spacing.
  const xh = Math.min(2.6, nb.linePitchMm * 0.36);
  const body = (xh / 2.6) * 2.3 * k / 0.52;       // font size whose average character is as wide as the pen's
  const rows = Math.max(3, Math.floor((nb.heightMm - nb.topMm - nb.bottomMm) / nb.linePitchMm) + 1);

  const pages: string[][] = [[]];
  let row = 0;
  const page = () => pages[pages.length - 1];
  const need = (n: number) => {
    if (row + n > rows && row > 0) {
      pages.push([]);
      row = 0;
    }
  };
  const baseline = (r: number) => top + r * pitch - pitch * 0.1;
  const indentUnit = 6 * k;                       // 6 mm

  for (const p of x.pages) {
    for (const b of p.blocks) {
      if (b.kind === "diagram") {
        if (!b.svg) continue;
        const { x: vx, y: vy, w, h, inner } = viewBox(tighten(b.svg));
        const usable = right - left;
        let width = Math.max(0.45, Math.min(1, (b.box.width || 0.6) * 1.15)) * usable;
        let n = Math.ceil((width * (h / w) + pitch * 0.4) / pitch);
        const maxRows = Math.max(3, rows - 1);
        if (n > maxRows) { n = maxRows; width = (n * pitch - pitch * 0.4) * (w / h); }
        need(n);
        const height = width * (h / w);
        const x0 = left + (usable - width) / 2;
        page().push(`<svg x="${x0.toFixed(1)}" y="${(top + row * pitch - pitch * 0.8).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" viewBox="${vx} ${vy} ${w} ${h}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`);
        row += n;
        continue;
      }
      if (b.kind === "table") {
        const cells = b.text.split("\n").map((r) => r.split("|").map((c) => c.trim())).filter((r) => r.some(Boolean));
        if (!cells.length) continue;
        need(Math.min(cells.length + 1, rows));
        page().push(table(b.text, left, top + row * pitch - pitch * 0.9, right - left, cells.length * pitch, body));
        row += cells.length + 1;
        continue;
      }
      const text = b.text.replace(/\s+$/g, "");
      if (!text.trim()) continue;
      const heading = b.kind === "heading";
      const size = heading ? body * (b.level <= 1 ? 1.25 : 1.1) : body;
      const lines: { text: string; indent: number }[] = [];
      for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line) continue;
        // Numbered questions ("Q1.", "1.", "2)") stay at the margin; sub-parts "(a)", "(ii)" and bullets are indented.
        const sub = /^\(?([a-h]|i{1,3}|iv|v|vi{0,3})\)\s/i.test(line);
        const bullet = /^[-•*–]\s/.test(line) || (b.kind === "list_item" && !/^(Q?\d+[.)]|\(?[a-z]\))\s/i.test(line));
        const indent = sub || bullet ? indentUnit : 0;
        const shown = b.kind === "list_item" && bullet && !/^[-•*–]\s/.test(line) ? `• ${line}` : line;
        // Continuation lines of a numbered item line up after its number, like the writer's hanging indent.
        const hang = (shown.match(/^(Q?\d+[.)]|\(?[a-z]{1,3}\)|[-•*–])\s+/i)?.[0].length ?? 0) * size * 0.52;
        wrap(shown, size, right - left - indent).forEach((t, n) => lines.push({ text: t, indent: indent + (n > 0 ? hang : 0) }));
      }
      if (!lines.length) continue;
      const gapBefore = heading && row > 0 ? 1 : 0;
      need(lines.length + gapBefore);
      if (row > 0) row += gapBefore;
      lines.forEach((line, n) => {
        const y = baseline(row + n);
        page().push(`<text x="${(left + line.indent).toFixed(1)}" y="${y.toFixed(1)}" font-size="${size.toFixed(1)}"${heading ? ' font-weight="700"' : ""}${b.kind === "equation" ? ' font-style="italic"' : ""}>${esc(line.text)}</text>`);
        if (heading) {
          const len = Math.min(right - left - line.indent, line.text.length * size * 0.55);
          page().push(`<line x1="${(left + line.indent).toFixed(1)}" y1="${(y + size * 0.2).toFixed(1)}" x2="${(left + line.indent + len).toFixed(1)}" y2="${(y + size * 0.2).toFixed(1)}" stroke="#1b2f8a" stroke-width="2"/>`);
        }
      });
      row += lines.length;
    }
  }

  const ruling = nb.ruled
    ? Array.from({ length: rows }, (_, r) => `<line x1="0" y1="${(top + r * pitch).toFixed(1)}" x2="${W}" y2="${(top + r * pitch).toFixed(1)}" stroke="#c9d6ee" stroke-width="1.5"/>`).join("") +
      (left > 20 ? `<line x1="${(left - 3 * k).toFixed(1)}" y1="0" x2="${(left - 3 * k).toFixed(1)}" y2="${pageH}" stroke="#e6a7a7" stroke-width="1.5"/>` : "")
    : "";
  return pages.filter((pg) => pg.length).map((content) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${pageH}" width="${W}" height="${pageH}">` +
    `<rect width="${W}" height="${pageH}" fill="white"/>${ruling}` +
    `<g font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" fill="#1b2f8a">${content.join("")}</g></svg>`
  );
}

/** A real table: rows split by newlines, cells by " | ", columns sized to their longest cell, with borders. */
function table(text: string, x: number, y: number, w: number, h: number, body: number): string {
  const rows = text.split("\n").map((r) => r.split("|").map((c) => c.trim())).filter((r) => r.some(Boolean));
  if (!rows.length) return "";
  const cols = Math.max(...rows.map((r) => r.length));
  const longest = Array.from({ length: cols }, (_, c) => Math.max(3, ...rows.map((r) => (r[c] ?? "").length)));
  const total = longest.reduce((a, b) => a + b, 0);
  const size = Math.min(body, (w / total) / 0.55);
  const rowH = Math.max(size * 1.6, h / rows.length);
  const colW = longest.map((l) => (l / total) * w);
  const out: string[] = [];
  rows.forEach((r, ri) => {
    let cx = x;
    for (let c = 0; c < cols; c++) {
      out.push(`<rect x="${cx.toFixed(1)}" y="${(y + ri * rowH).toFixed(1)}" width="${colW[c].toFixed(1)}" height="${rowH.toFixed(1)}" fill="none" stroke="#111" stroke-width="1.5"/>`);
      out.push(`<text x="${(cx + size * 0.4).toFixed(1)}" y="${(y + ri * rowH + rowH / 2 + size * 0.35).toFixed(1)}" font-size="${size.toFixed(1)}"${ri === 0 ? ' font-weight="700"' : ""}>${esc(r[c] ?? "")}</text>`);
      cx += colW[c];
    }
  });
  return out.join("");
}
