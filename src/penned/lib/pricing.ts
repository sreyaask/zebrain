import { getPageSize, type PageSizeId } from "./mock.ts";

export interface LayoutSettings {
  marginMm: number; // left/right margin
  lineSpacing: number; // multiplier, 1.0 – 2.0
  headingStyle: "underline" | "larger" | "plain";
  ink: "blue" | "black";
  pageSize: PageSizeId;
}

export const defaultLayout: LayoutSettings = {
  marginMm: 18,
  lineSpacing: 1.3,
  headingStyle: "underline",
  ink: "blue",
  pageSize: "long",
};

/** The page the plotter writes on, in millimetres (see pageSpecFor in lib/engine/layout.ts). */
export interface PageGeometry {
  widthMm: number;
  heightMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  linePitchMm: number;
}

// Average handwriting widths on the plotter (x-height 2.6 mm): a character with its spacing, and a word space.
const CHAR_MM = 2.3;
const SPACE_MM = 1.95;
const INDENT_MM = 6;
const MARKER = /^(Q?\d+[.)]|\(?[a-z]{1,3}\)|[a-z][.)]|[-•*–])$/i;
const DIAGRAM = /^\[\[diagram:[\w-]+\]\]$/;

/**
 * Pages the plotter will write for this text: the same lines per page (first line two line-spaces down, 12 mm at the
 * bottom), word wrapping, indents and hanging numbers, blank lines, and diagrams (about a third of a page each) moved to
 * the next page when they don't fit. Used for the price, so it errs slightly long rather than short.
 */
export function estimatePagesOn(text: string, g: PageGeometry): number {
  const trimmed = text.replace(/\r\n?/g, "\n").replace(/\s+$/, "");
  if (!trimmed.trim()) return 0;
  const pitch = Math.max(3, g.linePitchMm);
  const usable = Math.max(20, g.widthMm - g.marginLeftMm - g.marginRightMm);
  const perPage = Math.max(1, Math.floor((g.heightMm - pitch * 2 - 12) / pitch) + 1);
  let pages = 1;
  let row = 0;
  // Text lines run on across pages; a diagram that doesn't fit starts a new page (as the plotter does).
  const lines = (n: number) => {
    for (let i = 0; i < n; i++) {
      if (row >= perPage) { pages++; row = 0; }
      row++;
    }
  };
  const block = (n: number) => {
    if (row > 0 && row + n > perPage) { pages++; row = 0; }
    row += n;
  };
  for (const raw of trimmed.replace(/^\n+/, "").split("\n")) {
    if (DIAGRAM.test(raw.trim())) { block(Math.max(2, Math.round(perPage / 3))); continue; }
    const heading = raw.startsWith("# ");
    const words = (heading ? raw.slice(2) : raw).split(/[ \t]+/).filter(Boolean);
    if (!words.length) { lines(1); continue; }
    const lead = heading ? 0 : (raw.match(/^ +/)?.[0].length ?? 0);
    const first = Math.min(Math.floor(lead / 2) * INDENT_MM, usable / 2);
    const hang = MARKER.test(words[0]) && words.length > 1 ? Math.min(words[0].length * CHAR_MM + SPACE_MM, usable / 3) : 0;
    let indent = first, width = 0, count = 1, empty = true;
    for (const word of words) {
      let w = word.length * CHAR_MM;
      while (w > usable - indent) { count++; indent = first + hang; w -= usable - indent; empty = true; width = 0; }
      if (!empty && width + SPACE_MM + w > usable - indent) { count++; indent = first + hang; width = 0; empty = true; }
      width += (empty ? 0 : SPACE_MM) + w;
      empty = false;
    }
    lines(count);
  }
  return pages;
}

/** Pages for typed text on a standard page size with the given layout (website order flow). */
export function estimatePages(text: string, layout: LayoutSettings): number {
  const size = getPageSize(layout.pageSize);
  return estimatePagesOn(text, {
    widthMm: size.widthMm, heightMm: size.heightMm, marginLeftMm: layout.marginMm, marginRightMm: layout.marginMm,
    linePitchMm: 7.2 * layout.lineSpacing,
  });
}
