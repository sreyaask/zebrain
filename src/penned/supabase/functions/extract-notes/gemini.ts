// Reads pages of notes with Google Gemini and returns every block in reading order, with a box around each diagram.
// Plain fetch to the Gemini REST API (no SDK), so it runs the same in Supabase Edge Functions and in local tests.

export interface Page {
  media_type: "image/jpeg" | "image/png" | "application/pdf";
  data: string; // base64
}

export interface Box { x: number; y: number; width: number; height: number } // 0-1, top-left origin

export interface Block {
  kind: "heading" | "paragraph" | "list_item" | "equation" | "table" | "diagram";
  text: string;
  level: number;
  description: string;
  box: Box;
  /** Diagrams only: Gemini's clean redrawing as SVG (viewBox 0 0 1000 H, black strokes, labels as <text>). */
  svg: string;
}

export interface Extraction {
  pages: { page: number; blocks: Block[] }[];
}

export class GeminiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const PROMPT = `These are pages of a student's class notes (photos or scans; handwritten or printed).
Copy out EVERYTHING on each page exactly as written, in reading order (top to bottom; left column before right column).
- Keep the exact wording, spelling, capitalisation, numbering, symbols and units. Do not summarise, correct, translate or add anything.
- Each heading, paragraph, list item, equation and table is its own block. Headings get level 1-3; everything else level 0.
- Keep the writer's structure: each numbered question or point ("Q1.", "1.", "(a)", "(ii)", "-") starts its own block, with its number
  or bullet exactly as written. Inside a block, start a new line ("\\n") only where the writer deliberately started one (steps of working,
  given/find/solution lines, separate points, lines of a poem or address). Join lines that only wrapped because the page edge was reached.
- Keep underlined or boxed titles as headings; "Ans:", "Given:", "Solution:" and similar labels stay in the text exactly as written.
- Equations in plain text with Unicode symbols (e.g. F = m × a, v² = u² + 2as, ∫, √, π, Δ, →).
- Tables: one row per line, cells separated by " | ".
- Drawings, graphs, labelled figures, circuits, flow charts, maps, chemical structures: a "diagram" block. Put its labels in text,
  one sentence on what it shows in description, and a TIGHT box_2d around the whole drawing including its labels.
- For each diagram, also redraw it as clean SVG in "svg": <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 H"> where H keeps the
  diagram's proportions. Copy the drawing faithfully: same shapes, arrows, positions and labels. Use only line, polyline, polygon, rect,
  circle, ellipse, path and text elements; stroke="black", fill="none" (arrowheads may be filled black), stroke-width 3, labels as <text>
  with font-size 36 to 48. No images, styles, scripts, gradients or colours. For non-diagram blocks "svg" is an empty string.
- Every block has box_2d = [ymin, xmin, ymax, xmax], each 0-1000 relative to that page.
- Ignore page numbers, the notebook's printed lines and margin, stains, and anything outside the paper.
- If a word is unreadable, write [?] in its place.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    pages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          page: { type: "INTEGER", description: "1-based page number in the order received" },
          blocks: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                kind: { type: "STRING", enum: ["heading", "paragraph", "list_item", "equation", "table", "diagram"] },
                text: { type: "STRING" },
                level: { type: "INTEGER" },
                description: { type: "STRING" },
                box_2d: { type: "ARRAY", items: { type: "INTEGER" }, description: "[ymin, xmin, ymax, xmax] 0-1000" },
                svg: { type: "STRING", description: "Diagrams only: clean SVG redrawing; empty otherwise" },
              },
              required: ["kind", "text", "level", "description", "box_2d", "svg"],
              propertyOrdering: ["kind", "text", "level", "description", "box_2d", "svg"],
            },
          },
        },
        required: ["page", "blocks"],
        propertyOrdering: ["page", "blocks"],
      },
    },
  },
  required: ["pages"],
};

/** Calls Gemini once. Throws GeminiError with the HTTP status on failure. */
export type Thinking = "minimal" | "low" | "medium" | "high";

async function call(
  pages: Page[], apiKey: string, model: string, thinking: Thinking = "low", timeoutMs = 25_000, stop?: AbortSignal,
): Promise<Extraction> {
  // Never hang the customer: a slow model is skipped for the next one; `stop` cancels it when another answer won.
  const signal = stop ? AbortSignal.any([stop, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          ...pages.map((p) => ({ inline_data: { mime_type: p.media_type, data: p.data } })),
          { text: PROMPT },
        ],
      }],
      generationConfig: {
        temperature: 0,
        // Low thinking: ~3 s a page instead of 20+, with the same accuracy on copying text.
        thinkingConfig: { thinkingLevel: thinking },
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        maxOutputTokens: 65536,
      },
    }),
  });
  if (!res.ok) throw new GeminiError(res.status, `Gemini ${model} returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const cand = body?.candidates?.[0];
  if (!cand) throw new GeminiError(422, `Gemini returned no answer (${body?.promptFeedback?.blockReason ?? "unknown reason"})`);
  if (cand.finishReason === "MAX_TOKENS") throw new GeminiError(413, "Too much on these pages for one request.");
  const text: string = (cand.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  let raw: { pages?: { page: number; blocks?: (Omit<Block, "box"> & { box_2d: number[] })[] }[] };
  try {
    raw = JSON.parse(text);
  } catch {
    // Cut-off or malformed JSON: a different model (or a retry) usually gets it right.
    throw new GeminiError(422, `Gemini ${model} returned unreadable JSON (${cand.finishReason ?? "no reason"})`);
  }
  const kinds = new Set(["heading", "paragraph", "list_item", "equation", "table", "diagram"]);
  const out: Extraction = {
    pages: (raw.pages ?? []).map((p) => ({
      page: p.page,
      blocks: (p.blocks ?? []).filter((b) => kinds.has(b.kind)).map((b) => ({
        kind: b.kind, text: (b.text ?? "").replace(/\r\n?/g, "\n"), level: b.level ?? 0, description: b.description ?? "",
        box: toBox(b.box_2d), svg: b.kind === "diagram" ? cleanSvg(b.svg ?? "") : "",
      })),
    })),
  };
  if (!out.pages.some((p) => p.blocks.length)) throw new GeminiError(422, `Gemini ${model} found nothing on the page`);
  return out;
}

/** Keeps only drawing elements: no scripts, event handlers, links, images or styles get into files we show or plot. */
export function cleanSvg(svg: string): string {
  const m = svg.match(/<svg[\s\S]*<\/svg>/i);
  if (!m) return "";
  let s = m[0]
    .replace(/<(script|style|foreignObject|image|a|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|foreignObject|image|a|iframe|object|embed)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/\s(href|xlink:href)\s*=\s*("[^"]*"|'[^']*')/gi, "");
  if (!/xmlns=/.test(s)) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return tighten(s);
}

/**
 * Gemini often draws in a corner of its 1000-wide canvas (or past its edge). Re-fits the viewBox to what is actually drawn,
 * with a small margin, so the diagram is shown and plotted at the right size and nothing is cut off.
 */
export function tighten(svg: string): string {
  const xs: number[] = [], ys: number[] = [];
  const add = (x: number, y: number) => { if (Number.isFinite(x) && Number.isFinite(y)) { xs.push(x); ys.push(y); } };
  const at = (tag: string, k: string) => parseFloat(tag.match(new RegExp(`\\s${k}\\s*=\\s*["']([^"']*)`))?.[1] ?? "NaN");
  for (const m of svg.matchAll(/<(line|polyline|polygon|rect|circle|ellipse|path|text)\b[^>]*>([^<]*)/gi)) {
    const tag = m[0], kind = m[1].toLowerCase();
    if (kind === "line") { add(at(tag, "x1"), at(tag, "y1")); add(at(tag, "x2"), at(tag, "y2")); }
    else if (kind === "rect") { const x = at(tag, "x") || 0, y = at(tag, "y") || 0; add(x, y); add(x + at(tag, "width"), y + at(tag, "height")); }
    else if (kind === "circle" || kind === "ellipse") {
      const cx = at(tag, "cx"), cy = at(tag, "cy"), rx = kind === "circle" ? at(tag, "r") : at(tag, "rx"), ry = kind === "circle" ? rx : at(tag, "ry");
      add(cx - rx, cy - ry); add(cx + rx, cy + ry);
    } else if (kind === "text") {
      const size = at(tag, "font-size") || 40, x = at(tag, "x"), y = at(tag, "y"), w = m[2].trim().length * size * 0.55;
      const anchor = tag.match(/text-anchor\s*=\s*["'](\w+)/)?.[1];
      const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
      add(x0, y - size); add(x0 + w, y + size * 0.25);
    } else {
      const list = kind === "path" ? (tag.match(/\sd\s*=\s*["']([^"']*)/)?.[1] ?? "") : (tag.match(/points\s*=\s*["']([^"']*)/)?.[1] ?? "");
      // Paths: absolute coordinates only (relative moves and arc radii would mislead the box, so skip those paths).
      if (kind === "path" && /[a-yzA]/.test(list.replace(/e-?\d/gi, ""))) continue;
      const n = (list.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
      const hv = kind === "path" && /[HV]/.test(list);
      if (!hv) for (let i = 0; i + 1 < n.length; i += 2) add(n[i], n[i + 1]);
    }
  }
  if (xs.length < 2) return svg;
  const pad = 20;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  if (w < 40 || h < 40) return svg;
  const vb = `viewBox="${Math.round(x0)} ${Math.round(y0)} ${Math.round(w)} ${Math.round(h)}"`;
  return /viewBox\s*=/.test(svg) ? svg.replace(/viewBox\s*=\s*"[^"]*"/i, vb) : svg.replace(/<svg/i, `<svg ${vb}`);
}

/** Gemini's [ymin, xmin, ymax, xmax] in 0-1000 → x/y/width/height in 0-1. */
function toBox(b: number[] | undefined): Box {
  if (!b || b.length !== 4) return { x: 0, y: 0, width: 0, height: 0 };
  const [y0, x0, y1, x1] = b.map((v) => Math.min(1000, Math.max(0, v)) / 1000);
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

// Models in order of preference. Flash-Lite copies handwriting as accurately as Flash on our tests (0% word errors on
// both), answers faster, is busy less often on the free plan and costs about a sixth as much (₹0.3 a page vs ₹1.9).
export const LITE = ["gemini-3.1-flash-lite", "gemini-flash-lite-latest"];
export const FLASH = ["gemini-3.5-flash", "gemini-3.8-flash"];
export const MODELS = [...LITE, ...FLASH];

const wait = (ms: number, stop?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    stop?.addEventListener("abort", () => { clearTimeout(t); reject(stop.reason); }, { once: true });
  });

/**
 * Reads the pages with the first model that answers. A busy model (429/500/503) gets one more try after a short pause;
 * a model this key can't use (404), a slow one, or an unreadable or empty answer moves on to the next model.
 */
export async function extract(
  pages: Page[], apiKey: string, models = MODELS, thinking: Thinking = "low", timeoutMs = 25_000, stop?: AbortSignal,
): Promise<Extraction> {
  let last: unknown = new GeminiError(503, "No Gemini model answered");
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (stop?.aborted) throw stop.reason;
      try {
        return await call(pages, apiKey, model, thinking, timeoutMs, stop);
      } catch (e) {
        if (stop?.aborted) throw e;
        last = e;
        const busy = e instanceof GeminiError && [429, 500, 503].includes(e.status);
        if (busy && attempt === 0) { await wait(1500, stop); continue; }
        if (e instanceof GeminiError && e.status === 413) throw e; // too much for any model: the app sends fewer pages
        break; // 404, timeout, unreadable or empty answer, or still busy: next model
      }
    }
  }
  throw last;
}

const SUBPART = /^\(?([a-h]|i{1,3}|iv|v|vi{0,3})\)\s/i;
const NUMBERED = /^(Q?\d+[.)]|[a-z][.)])\s/i;
const BULLET = /^[-•*–]\s/;

/** A table as a drawing the plotter can write: a ruled grid, cell text as labels (written in the customer's hand). */
export function tableSvg(text: string): string {
  const rows = text.split("\n").map((r) => r.split("|").map((c) => c.trim())).filter((r) => r.some(Boolean));
  if (!rows.length) return "";
  const cols = Math.max(...rows.map((r) => r.length));
  const size = 40, char = size * 0.55, rowH = 72, pad = 14;
  const colW = Array.from({ length: cols }, (_, c) => Math.max(4, ...rows.map((r) => (r[c] ?? "").length)) * char + pad * 2);
  const w = colW.reduce((a, b) => a + b, 0), h = rows.length * rowH;
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const out = [`<rect x="0" y="0" width="${w}" height="${h}" stroke="black" stroke-width="3" fill="none"/>`];
  for (let r = 1; r < rows.length; r++) out.push(`<line x1="0" y1="${r * rowH}" x2="${w}" y2="${r * rowH}" stroke="black" stroke-width="3"/>`);
  let x = 0;
  for (let c = 0; c < cols; c++) {
    if (c > 0) out.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="black" stroke-width="3"/>`);
    rows.forEach((row, r) => {
      if (row[c]) out.push(`<text x="${x + pad}" y="${r * rowH + rowH * 0.68}" font-size="${size}">${esc(row[c])}</text>`);
    });
    x += colW[c];
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ${w + 20} ${h + 20}">${out.join("")}</svg>`;
}

/**
 * Turns blocks into Penned's order text, the exact text the pen writes (and the preview draws): "# " headings with a
 * blank line before them, numbered questions at the margin, sub-parts "(a)" and bullets indented two spaces (6 mm),
 * one line per line the writer started, a blank line between source pages, and "[[diagram:<id>]]" for each diagram and
 * each table (tables are drawn as grids). Each diagram carries its SVG drawing for the plotter.
 */
export function toOrder(x: Extraction) {
  const lines: string[] = [];
  const diagrams: { id: string; page: number; box: Box; description: string; svg: string }[] = [];
  const blankBefore = () => { if (lines.length && lines[lines.length - 1] !== "") lines.push(""); };
  const newId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  x.pages.forEach((p, pi) => {
    if (pi > 0) blankBefore();
    for (const b of p.blocks) {
      if (b.kind === "diagram" || b.kind === "table") {
        const svg = b.kind === "table" ? tableSvg(b.text) : b.svg;
        if (b.kind === "table" && !svg) continue;
        const id = newId();
        diagrams.push({ id, page: p.page, box: b.box, description: b.kind === "table" ? "Table" : b.description, svg });
        lines.push(`[[diagram:${id}]]`);
        continue;
      }
      const rows = b.text.split("\n").map((l) => l.trim().replace(/\s+/g, " ")).filter(Boolean);
      if (!rows.length) continue;
      if (b.kind === "heading") {
        blankBefore();
        lines.push(`# ${rows.join(" ").replace(/^#+\s*/, "")}`);
        continue;
      }
      for (const row of rows) {
        if (SUBPART.test(row) || BULLET.test(row)) lines.push(`  ${row}`);
        else if (b.kind === "list_item" && !NUMBERED.test(row)) lines.push(`  - ${row}`);
        else lines.push(row);
      }
    }
  });
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return { text: lines.join("\n"), diagrams };
}

/**
 * Fast and reliable: Flash-Lite starts at once; if it hasn't answered in 10 s, Flash starts too, and the first good
 * answer wins. The other request is then cancelled, so a page is paid for once. Typically 3-8 s a page; never over 45 s.
 */
export async function extractFast(pages: Page[], apiKey: string): Promise<Extraction> {
  const lite = new AbortController(), flash = new AbortController();
  // Flash starts after 10 s, or at once if Flash-Lite has already failed.
  let startFlash = () => {};
  const go = new Promise<void>((resolve) => { startFlash = resolve; });
  const timer = setTimeout(() => startFlash(), 10_000);
  // The app waits about 60 s for an answer: give up on this page at 45 s so it can be read on the phone instead.
  let late = false;
  const deadline = setTimeout(() => { late = true; lite.abort(); flash.abort(); startFlash(); }, 45_000);
  try {
    return await Promise.any([
      extract(pages, apiKey, LITE, "low", 25_000, lite.signal).then(
        (x) => { flash.abort(); return x; },
        (e) => { startFlash(); throw e; },
      ),
      go.then(() => extract(pages, apiKey, FLASH, "low", 25_000, flash.signal)).then((x) => { lite.abort(); return x; }),
    ]);
  } catch (e) {
    if (late) throw new GeminiError(503, "Gemini took too long on this page");
    const errors = (e as AggregateError).errors ?? [e];
    throw errors.find((x) => x instanceof GeminiError) ?? errors[0];
  } finally {
    clearTimeout(timer);
    clearTimeout(deadline);
  }
}

/** Reads each image page in its own request, all at the same time, so ten pages take about as long as one. */
export async function extractPages(pages: Page[], apiKey: string): Promise<Extraction> {
  const results = await Promise.all(pages.map((p) => extractFast([p], apiKey)));
  return { pages: results.map((r, i) => ({ page: i + 1, blocks: r.pages.flatMap((x) => x.blocks) })) };
}
