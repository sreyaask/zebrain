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

async function call(pages: Page[], apiKey: string, model: string, thinking: Thinking = "low", timeoutMs = 25_000): Promise<Extraction> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs), // never hang the customer: a slow model is skipped for the next one
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
  const raw = JSON.parse(text) as { pages: { page: number; blocks: (Omit<Block, "box"> & { box_2d: number[] })[] }[] };
  return {
    pages: (raw.pages ?? []).map((p) => ({
      page: p.page,
      blocks: (p.blocks ?? []).map((b) => ({
        kind: b.kind, text: b.text ?? "", level: b.level ?? 0, description: b.description ?? "", box: toBox(b.box_2d),
        svg: b.kind === "diagram" ? cleanSvg(b.svg ?? "") : "",
      })),
    })),
  };
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
  return s;
}

/** Gemini's [ymin, xmin, ymax, xmax] in 0-1000 → x/y/width/height in 0-1. */
function toBox(b: number[] | undefined): Box {
  if (!b || b.length !== 4) return { x: 0, y: 0, width: 0, height: 0 };
  const [y0, x0, y1, x1] = b.map((v) => Math.min(1000, Math.max(0, v)) / 1000);
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

// Models in order of preference. Flash models work on Google's free plan; Pro needs billing turned on for the key
// (without it Pro answers 429 "quota exceeded" and we move on).
export const MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.7-flash"];

/** Reads the pages with the first model that answers, retrying briefly when Gemini is busy. */
export async function extract(pages: Page[], apiKey: string, models = MODELS, thinking: Thinking = "low", timeoutMs = 25_000): Promise<Extraction> {
  let last: unknown;
  for (const model of models) {
    // One try per model; the next model (or the Flash-Lite race in extractFast) covers a busy one.
    for (let attempt = 0; attempt < 1; attempt++) {
      try {
        return await call(pages, apiKey, model, thinking, timeoutMs);
      } catch (e) {
        last = e;
        // Only capacity/availability problems are worth retrying; bad input won't improve.
        if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) break; // too slow: next model
        if (!(e instanceof GeminiError) || ![404, 429, 500, 503].includes(e.status)) throw e;
        if (e.status === 404) break; // model not available to this key: try the next one
      }
    }
  }
  throw last;
}

/** Turns blocks into Penned's order text, with an id for each diagram the app should crop. */
export function toOrder(x: Extraction) {
  const lines: string[] = [];
  const diagrams: { id: string; page: number; box: Box; description: string }[] = [];
  for (const p of x.pages) {
    for (const b of p.blocks) {
      if (b.kind === "diagram") {
        const id = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
        diagrams.push({ id, page: p.page, box: b.box, description: b.description });
        lines.push(`[[diagram:${id}]]`);
      } else if (b.kind === "heading") {
        lines.push(`# ${b.text.trim()}`);
      } else if (b.kind === "list_item") {
        const t = b.text.trim();
        lines.push(/^([-•*]|\d+[.)]|[a-z][.)])\s/i.test(t) ? t : `- ${t}`);
      } else {
        lines.push(...b.text.split("\n").map((l) => l.trim()).filter(Boolean));
      }
    }
    lines.push("");
  }
  return { text: lines.join("\n").trim(), diagrams };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fast and reliable: the best Flash model starts at once; if it hasn't answered in 5 s (Gemini's free plan is often
 * "busy"), Flash-Lite starts too, and the first good answer wins. Typically 3-10 s a page.
 */
export function extractFast(pages: Page[], apiKey: string): Promise<Extraction> {
  return Promise.any([
    extract(pages, apiKey, ["gemini-3.5-flash", "gemini-3.8-flash"]),
    wait(5000).then(() => extract(pages, apiKey, ["gemini-3.1-flash-lite", "gemini-flash-lite-latest"])),
  ]).catch((e: AggregateError) => {
    throw e.errors?.find((x) => x instanceof GeminiError) ?? e.errors?.[0] ?? e;
  });
}

/** Reads each image page in its own request, all at the same time, so ten pages take about as long as one. */
export async function extractPages(pages: Page[], apiKey: string): Promise<Extraction> {
  const results = await Promise.all(pages.map((p) => extractFast([p], apiKey)));
  return { pages: results.map((r, i) => ({ page: i + 1, blocks: r.pages.flatMap((x) => x.blocks) })) };
}
