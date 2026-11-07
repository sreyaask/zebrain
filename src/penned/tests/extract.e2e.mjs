// End-to-end: render a full sample sheet in Chromium, then extract glyphs and lay out a page.
// Run: node tests/extract.e2e.mjs   (needs Playwright + Chromium)
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // preinstalled globally
import { SHEET_LINES, SHEET_REPEATS, extractGlyphs, binarize, layoutHandwriting, pageSpecFor, pageToSvg } from "../lib/engine/index.ts";

const outDir = process.env.E2E_OUT || "tests/.out";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
const { w, h, data } = await page.evaluate(({ lines, repeats }) => {
  const c = document.createElement("canvas");
  c.width = 1800;
  c.height = 1500;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f4f1ea"; // off-white paper
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#1d2f80"; // blue ink
  ctx.font = "40px 'DejaVu Sans'";
  ctx.letterSpacing = "9px"; // letters written separately, as the sheet asks
  let y = 90;
  for (let r = 0; r < repeats; r++)
    for (const l of lines) {
      ctx.save();
      ctx.translate(60, y);
      ctx.rotate((r - 1) * 0.004); // a slightly tilted phone photo
      ctx.fillText(l, 0, 0);
      ctx.restore();
      y += 150;
    }
  const img = ctx.getImageData(0, 0, c.width, c.height);
  return { w: c.width, h: c.height, data: Array.from(img.data) };
}, { lines: [...SHEET_LINES], repeats: SHEET_REPEATS });
await browser.close();

const bm = binarize(new Uint8ClampedArray(data), w, h);
const t0 = Date.now();
const r = extractGlyphs(bm);
const ms = Date.now() - t0;

const bad = r.lines.filter((l) => !l.ok);
console.log(`lines: ${r.lines.length}, failed: ${bad.length}, missing: [${r.missing.join(" ")}], ${ms} ms`);
assert.equal(r.lines.length, SHEET_LINES.length * SHEET_REPEATS, "found every written line");
assert.deepEqual(bad, [], "every line matched the sheet");
assert.deepEqual(r.missing, [], "every sheet character has a sample");
const perSheet = {};
for (const l of SHEET_LINES) for (const c of l) if (c.trim()) perSheet[c] = (perSheet[c] || 0) + 1;
for (const [ch, samples] of Object.entries(r.glyphSet.glyphs)) assert.equal(samples.length, perSheet[ch] * SHEET_REPEATS, `samples of ${ch}`);

// Sanity of the measured geometry: x-height letters ~1, ascenders ~1.4+, descenders below 0.
const avg = (c, k) => r.glyphSet.glyphs[c].reduce((s, g) => s + g[k], 0) / r.glyphSet.glyphs[c].length;
assert.ok(Math.abs(avg("o", "top") - 1) < 0.25, `o top ${avg("o", "top")}`);
assert.ok(avg("h", "top") > 1.15, `h top ${avg("h", "top")}`);
assert.ok(avg("g", "bottom") < -0.25, `g bottom ${avg("g", "bottom")}`);

// Lay out the sample note on a ruled notebook page and save it for a visual check.
const spec = pageSpecFor({ widthMm: 176, heightMm: 250 }, 18, 1.3);
const note = "# Laws of Motion\nNewton's Second Law: The rate of change of momentum of a body is directly proportional to the applied force. F = ma, where m is mass and a is acceleration.";
const lay = layoutHandwriting(note, r.glyphSet, spec, { headingStyle: "underline", seed: "PEN-1042" });
console.log(`layout: ${lay.pages.length} page(s), ${lay.lines} lines, missing [${lay.missing.join(" ")}]`);
assert.equal(lay.pages.length, 1);
writeFileSync(`${outDir}/sample-page.svg`, pageToSvg(lay.pages[0], "blue", { ruled: true, pitchMm: spec.linePitchMm, topMm: spec.topMm }));
console.log("ok");
