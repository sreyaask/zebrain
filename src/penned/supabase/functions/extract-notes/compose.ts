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
