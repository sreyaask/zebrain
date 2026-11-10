// Builds clean, formatted SVG pages from Gemini's reading: headings, paragraphs, lists, equations and tables typeset in
// reading order, with each diagram placed as Gemini's own SVG redrawing. These are the "formatted notes" the customer
// previews on the phone; the pen plotter later writes the same content in the customer's handwriting.
import { tighten } from "./gemini.ts";
import type { Block, Extraction } from "./gemini.ts";

const W = 1000; // page width in SVG units (A4 proportions)
const H = 1414;
const MARGIN = 70;
const BODY = 30; // body font size
const LINE = 46; // body line height

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

interface Piece { height: number; render: (y: number) => string }

function pieces(b: Block): Piece[] {
  const usable = W - MARGIN * 2;
  if (b.kind === "diagram") {
    if (!b.svg) return [];
    const { w, h, inner } = viewBox(b.svg);
    const width = Math.min(usable, 760);
    const height = Math.min(700, width * (h / w));
    const x = (W - width) / 2;
    return [{
      height: height + 30,
      render: (y) => `<svg x="${x}" y="${y + 10}" width="${width}" height="${height}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`,
    }];
  }
  const heading = b.kind === "heading";
  const size = heading ? (b.level <= 1 ? 44 : 36) : BODY;
  const lh = heading ? size * 1.4 : LINE;
  const indent = b.kind === "list_item" ? 34 : 0;
  const text = b.kind === "list_item" && !/^([-•*]|\d+[.)]|[a-z][.)])\s/i.test(b.text.trim()) ? `• ${b.text.trim()}` : b.text.trim();
  const lines = b.kind === "table" ? text.split("\n") : wrap(text, size, usable - indent);
  return lines.map((line, i) => ({
    height: lh + (heading && i === lines.length - 1 ? 14 : 0) + (i === 0 && heading ? 10 : 0),
    render: (y) =>
      `<text x="${MARGIN + indent + (i > 0 && b.kind === "list_item" ? 24 : 0)}" y="${y + lh * 0.8 + (i === 0 && heading ? 10 : 0)}"` +
      ` font-size="${size}"${heading ? ' font-weight="700"' : ""}${b.kind === "equation" ? ' font-style="italic"' : ""}>${esc(line)}</text>` +
      (heading && b.level <= 1 && i === lines.length - 1
        ? `<line x1="${MARGIN}" y1="${y + lh + 8}" x2="${W - MARGIN}" y2="${y + lh + 8}" stroke="#111" stroke-width="2"/>`
        : ""),
  }));
}

/** One SVG document per output page (long notes flow onto more pages). */
export function composePages(x: Extraction): string[] {
  const all = x.pages.flatMap((p) => p.blocks.flatMap((b) => [...pieces(b), { height: 12, render: () => "" }]));
  const pages: string[][] = [[]];
  let y = MARGIN;
  for (const piece of all) {
    if (y + piece.height > H - MARGIN && pages[pages.length - 1].length) {
      pages.push([]);
      y = MARGIN;
    }
    pages[pages.length - 1].push(piece.render(y));
    y += piece.height;
  }
  return pages.map((body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="white"/>` +
    `<g font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" fill="#111">${body.join("")}</g></svg>`
  );
}

/** Width and height of a JPEG or PNG from its base64 bytes (no decoding). */
export function imageSize(base64: string): { w: number; h: number } | null {
  const bin = atob(base64.slice(0, 200_000));
  const at = (i: number) => bin.charCodeAt(i);
  if (at(0) === 0x89 && bin.slice(1, 4) === "PNG") {
    const be = (i: number) => (at(i) << 24 | at(i + 1) << 16 | at(i + 2) << 8 | at(i + 3)) >>> 0;
    return { w: be(16), h: be(20) };
  }
  if (at(0) !== 0xff || at(1) !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bin.length) {
    if (at(i) !== 0xff) { i++; continue; }
    const marker = at(i + 1);
    const len = at(i + 2) << 8 | at(i + 3);
    // SOF0-SOF15 except DHT (C4), JPG (C8), DAC (CC) carry the frame size.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: at(i + 5) << 8 | at(i + 6), w: at(i + 7) << 8 | at(i + 8) };
    }
    i += 2 + len;
  }
  return null;
}

/**
 * Formatted notebook pages: ruled lines and a margin, every line of text sitting on a ruled line, headings larger and
 * underlined, list items and sub-parts indented, tables as real grids on the lines, and each diagram (Gemini's drawing)
 * at the same share of the page width it had on the original. Content keeps the original order; nothing overlaps; long
 * notes continue onto new pages. `sizes` are the source pages' pixel sizes (their proportions set the page shape).
 */
export function composeLayout(x: Extraction, sizes: ({ w: number; h: number } | null)[]): string[] {
  const first = sizes.find((s) => s && s.w > 0);
  const pageH = first ? Math.max(1100, Math.min(1600, Math.round((W * first.h) / first.w))) : H;
  const pitch = 52;                 // ruled line spacing
  const top = pitch * 2;            // first ruled line
  const left = 100;                 // text starts right of the margin line
  const right = W - 50;
  const body = 31;                  // body text size on a line
  const rows = Math.floor((pageH - top - 40) / pitch);

  const pages: string[][] = [[]];
  let row = 0;
  const page = () => pages[pages.length - 1];
  const need = (n: number) => {
    if (row + n > rows && row > 0) {
      pages.push([]);
      row = 0;
    }
  };
  const baseline = (r: number) => top + r * pitch - 9;

  for (const p of x.pages) {
    for (const b of p.blocks) {
      if (b.kind === "diagram") {
        if (!b.svg) continue;
        const { x: vx, y: vy, w, h, inner } = viewBox(tighten(b.svg));
        const width = Math.max(0.5, Math.min(0.9, (b.box.width || 0.6) * 1.4)) * (right - left);
        let height = width * (h / w);
        const maxRows = Math.max(4, rows - 2);
        let n = Math.ceil((height + pitch * 0.5) / pitch);
        if (n > maxRows) { n = maxRows; height = n * pitch - pitch * 0.5; }
        need(n);
        const x0 = left + ((right - left) - Math.min(width, height * (w / h))) / 2;
        page().push(`<svg x="${x0.toFixed(1)}" y="${(top + row * pitch - pitch * 0.75).toFixed(1)}" width="${Math.min(width, height * (w / h)).toFixed(1)}" height="${height.toFixed(1)}" viewBox="${vx} ${vy} ${w} ${h}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`);
        row += n;
        continue;
      }
      if (b.kind === "table") {
        const cells = b.text.split("\n").map((r) => r.split("|").map((c) => c.trim())).filter((r) => r.some(Boolean));
        if (!cells.length) continue;
        need(cells.length + 1);
        page().push(table(b.text, left, top + row * pitch - pitch * 0.85, right - left, cells.length * pitch, body));
        row += cells.length + 1;
        continue;
      }
      const text = b.text.trim();
      if (!text) continue;
      const heading = b.kind === "heading";
      const size = heading ? (b.level <= 1 ? body * 1.35 : body * 1.15) : body;
      // Sub-parts like "(b) …" or "b) …" and list items are indented; numbered questions stay at the margin.
      const sub = /^\(?[a-z]\)|^\(?[ivx]+\)\s/i.test(text);
      const numbered = /^(\d+[.)]|Q\d+[.)])\s/i.test(text);
      const indent = (b.kind === "list_item" && !numbered) || sub ? 34 : 0;
      const shown = b.kind === "list_item" && !/^([-•*]|\d+[.)]|[a-z][.)])\s/i.test(text) ? `• ${text}` : text;
      const lines = wrap(shown, size, right - left - indent);
      const gapBefore = heading && row > 0 ? 1 : 0;
      need(lines.length + gapBefore);
      row += row > 0 ? gapBefore : 0;
      lines.forEach((line, n) => {
        const y = baseline(row + n);
        const hang = n > 0 && (b.kind === "list_item") ? 22 : 0;
        page().push(`<text x="${left + indent + hang}" y="${y.toFixed(1)}" font-size="${size.toFixed(1)}"${heading ? ' font-weight="700"' : ""}${b.kind === "equation" ? ' font-style="italic"' : ""}>${esc(line)}</text>`);
        if (heading) {
          const len = Math.min(right - left, line.length * size * 0.54);
          page().push(`<line x1="${left}" y1="${(y + 6).toFixed(1)}" x2="${(left + len).toFixed(1)}" y2="${(y + 6).toFixed(1)}" stroke="#111" stroke-width="2"/>`);
        }
      });
      row += lines.length;
    }
  }

  const ruling = Array.from({ length: rows + 1 }, (_, r) => `<line x1="0" y1="${top + r * pitch}" x2="${W}" y2="${top + r * pitch}" stroke="#c9d6ee" stroke-width="1.5"/>`).join("") +
    `<line x1="${left - 18}" y1="0" x2="${left - 18}" y2="${pageH}" stroke="#e6a7a7" stroke-width="1.5"/>`;
  return pages.filter((pg) => pg.length).map((body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${pageH}" width="${W}" height="${pageH}">` +
    `<rect width="${W}" height="${pageH}" fill="white"/>${ruling}` +
    `<g font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" fill="#1b2f8a">${body.join("")}</g></svg>`
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
