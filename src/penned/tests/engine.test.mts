// Run: node tests/engine.test.mts   (Node 22+, uses built-in TypeScript stripping)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  binarize, components, thin, traceSkeleton, extractGlyphs, layoutHandwriting, pageSpecFor,
  pagesToGcode, pageToSvg, plotterPresets, SHEET_LINES, SHEET_REPEATS, expectedChars,
  type Bitmap, type GlyphSet,
} from "../lib/engine/index.ts";

function blank(w: number, h: number): Bitmap {
  return { width: w, height: h, data: new Uint8Array(w * h) };
}
function disc(bm: Bitmap, cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) bm.data[(cy + y) * bm.width + cx + x] = 1;
}
function ring(bm: Bitmap, cx: number, cy: number, r: number, t = 2) {
  for (let y = -r - t; y <= r + t; y++)
    for (let x = -r - t; x <= r + t; x++) {
      const d = Math.hypot(x, y);
      if (d >= r - t && d <= r + t) bm.data[(cy + y) * bm.width + cx + x] = 1;
    }
}
function bar(bm: Bitmap, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) bm.data[y * bm.width + x] = 1;
}

test("binarize finds dark ink on light paper", () => {
  const w = 40, h = 20, rgba = new Uint8ClampedArray(w * h * 4).fill(240);
  for (let y = 5; y < 15; y++) for (let x = 10; x < 30; x++) {
    const i = (y * w + x) * 4;
    rgba[i] = rgba[i + 1] = rgba[i + 2] = 30;
  }
  const bm = binarize(rgba, w, h);
  assert.equal(bm.data.reduce((a, b) => a + b, 0), 200);
});

test("a ring traces to one closed stroke", () => {
  const bm = blank(60, 60);
  ring(bm, 30, 30, 18);
  const strokes = traceSkeleton(thin(bm));
  assert.equal(strokes.length, 1);
  const s = strokes[0];
  assert.ok(Math.hypot(s[0].x - s[s.length - 1].x, s[0].y - s[s.length - 1].y) <= 1.5, "loop is closed");
});

test("a thick bar thins to a single straight stroke", () => {
  const bm = blank(80, 30);
  bar(bm, 10, 10, 70, 16);
  const strokes = traceSkeleton(thin(bm));
  assert.equal(strokes.length, 1);
  assert.ok(strokes[0].length <= 3, "simplified to a line");
});

test("components separates an i-stem from its dot", () => {
  const bm = blank(30, 60);
  bar(bm, 12, 20, 16, 50);
  disc(bm, 14, 10, 3);
  assert.equal(components(bm).length, 2);
});

// A tiny synthetic glyph set: every char is a box outline of width 0.6.
function boxGlyphs(chars: string): GlyphSet {
  const glyphs: GlyphSet["glyphs"] = {};
  for (const c of chars)
    glyphs[c] = [{ char: c, width: 0.6, top: 1, bottom: 0, strokes: [[{ x: 0, y: 0 }, { x: 0.6, y: 0 }, { x: 0.6, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }]] }];
  return { version: 1, glyphs, xHeightPx: 20, createdAt: "" };
}

test("layout reflows text onto notebook pages and paginates", () => {
  const set = boxGlyphs("abcdefghijklmnopqrstuvwxyzT.");
  const spec = pageSpecFor({ widthMm: 176, heightMm: 250 }, 18, 1.3);
  const para = "the quick brown fox jumps over the lazy dog. ".repeat(12);
  const text = `# Title\n${Array(20).fill(para).join("\n")}`;
  const r = layoutHandwriting(text, set, spec, { headingStyle: "underline", seed: "PEN-1" });
  assert.ok(r.pages.length >= 3, `expected several pages, got ${r.pages.length}`);
  for (const page of r.pages)
    for (const s of page.strokes)
      for (const p of s) {
        assert.ok(p.x >= spec.marginLeftMm - 2 && p.x <= spec.widthMm - spec.marginRightMm + 2, `x ${p.x} inside margins`);
        assert.ok(p.y > 0 && p.y < spec.heightMm, `y ${p.y} on page`);
      }
  assert.deepEqual(r.missing, []);
  // Same seed, same output (re-generating a job is reproducible).
  const again = layoutHandwriting(text, set, spec, { headingStyle: "underline", seed: "PEN-1" });
  assert.deepEqual(again.pages[0].strokes.slice(0, 5), r.pages[0].strokes.slice(0, 5));
});

test("layout reports characters it cannot draw, and draws punctuation fallbacks", () => {
  const set = boxGlyphs("ab");
  const spec = pageSpecFor({ widthMm: 210, heightMm: 297 }, 18, 1.3);
  const r = layoutHandwriting("ab: ab-ab zq", set, spec, { headingStyle: "plain", seed: "x" });
  assert.deepEqual(r.missing.sort(), ["q", "z"]);
});

test("G-code has pen moves for every stroke and pauses between pages", () => {
  const set = boxGlyphs("ab");
  const spec = pageSpecFor({ widthMm: 105, heightMm: 148 }, 10, 1.0);
  const r = layoutHandwriting(Array(60).fill("ab ab ab ab").join("\n"), set, spec, { headingStyle: "plain", seed: "y" });
  assert.ok(r.pages.length >= 2);
  const s = plotterPresets["z-axis"].settings;
  const g = pagesToGcode(r.pages, s, { orderCode: "PEN-TEST" });
  const strokes = r.pages.reduce((n, p) => n + p.strokes.length, 0);
  assert.equal(g.split("\n").filter((l) => l === s.penDown).length, strokes);
  assert.equal(g.split("\n").filter((l) => l.startsWith("M0")).length, r.pages.length - 1);
  assert.match(g, /^; Penned PEN-TEST/);
  const svg = pageToSvg(r.pages[0], "black", { ruled: true, pitchMm: spec.linePitchMm, topMm: spec.topMm });
  assert.match(svg, /width="105mm"/);
  assert.equal((svg.match(/<path /g) || []).length, r.pages[0].strokes.length);
});

test("sheet definition: 91 characters per repetition", () => {
  assert.equal(SHEET_LINES.reduce((n, l) => n + expectedChars(l).length, 0), 91);
  assert.equal(SHEET_REPEATS, 3);
});

// End-to-end extraction with a rendered sheet is in tests/extract.e2e.mjs (needs Chromium).
export { extractGlyphs };
