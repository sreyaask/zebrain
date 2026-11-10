// Builds clean, formatted SVG pages from Gemini's reading: headings, paragraphs, lists, equations and tables typeset in
// reading order, with each diagram placed as Gemini's own SVG redrawing. These are the "formatted notes" the customer
// previews on the phone; the pen plotter later writes the same content in the customer's handwriting.
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
function viewBox(svg: string): { w: number; h: number; inner: string } {
  const vb = svg.match(/viewBox\s*=\s*"([\d.\-\s,]+)"/i)?.[1].trim().split(/[\s,]+/).map(Number);
  const w = vb && vb[2] > 0 ? vb[2] : 1000;
  const h = vb && vb[3] > 0 ? vb[3] : 600;
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
  return { w, h, inner };
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
 * Same layout as the original page: every block sits where it was, at the size it was written. Text size comes from the
 * block's height and how many lines it needs; diagrams are Gemini's drawing fitted into their original box.
 * One SVG per source page; `sizes[i]` is that page's pixel size (A4 proportions when unknown).
 */
export function composeLayout(x: Extraction, sizes: ({ w: number; h: number } | null)[]): string[] {
  return x.pages.map((p, i) => {
    const s = sizes[i];
    const pageH = s && s.w > 0 ? Math.round((W * s.h) / s.w) : H;
    const parts: string[] = [];
    for (const b of p.blocks) {
      const bx = b.box.x * W, by = b.box.y * pageH, bw = Math.max(40, b.box.width * W), bh = Math.max(20, b.box.height * pageH);
      if (b.kind === "diagram") {
        if (!b.svg) continue;
        const { w, h, inner } = viewBox(b.svg);
        parts.push(`<svg x="${bx}" y="${by}" width="${bw}" height="${bh}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`);
        continue;
      }
      const raw = b.kind === "list_item" && !/^([-•*]|\d+[.)]|[a-z][.)])\s/i.test(b.text.trim()) ? `• ${b.text.trim()}` : b.text.trim();
      if (!raw) continue;
      // Find the font size at which the text, wrapped to the box width, fills the box height (like the original).
      let lines = raw.split("\n");
      let size = bh / (lines.length * 1.25);
      for (let k = 0; k < 4; k++) {
        lines = b.kind === "table" ? raw.split("\n") : wrap(raw, size, bw);
        size = Math.min(bh / (lines.length * 1.25), (bw / Math.max(...lines.map((l) => l.length), 1)) / 0.5);
      }
      size = Math.max(12, Math.min(72, size));
      const lh = size * 1.25;
      const weight = b.kind === "heading" ? ' font-weight="700"' : "";
      lines.forEach((line, n) => {
        parts.push(`<text x="${bx}" y="${by + lh * n + size}" font-size="${size.toFixed(1)}"${weight}>${esc(line)}</text>`);
      });
      if (b.kind === "heading") {
        const y = by + lh * (lines.length - 1) + size * 1.15;
        parts.push(`<line x1="${bx}" y1="${y}" x2="${bx + Math.min(bw, lines[lines.length - 1].length * size * 0.52)}" y2="${y}" stroke="#111" stroke-width="${Math.max(1.5, size / 16)}"/>`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${pageH}" width="${W}" height="${pageH}">` +
      `<rect width="${W}" height="${pageH}" fill="white"/>` +
      `<g font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" fill="#111">${parts.join("")}</g></svg>`;
  });
}
