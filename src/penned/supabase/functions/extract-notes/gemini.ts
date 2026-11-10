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
              },
              required: ["kind", "text", "level", "description", "box_2d"],
              propertyOrdering: ["kind", "text", "level", "description", "box_2d"],
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
async function call(pages: Page[], apiKey: string, model: string): Promise<Extraction> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
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
      blocks: (p.blocks ?? []).map((b) => ({ kind: b.kind, text: b.text ?? "", level: b.level ?? 0, description: b.description ?? "", box: toBox(b.box_2d) })),
    })),
  };
}

/** Gemini's [ymin, xmin, ymax, xmax] in 0-1000 → x/y/width/height in 0-1. */
function toBox(b: number[] | undefined): Box {
  if (!b || b.length !== 4) return { x: 0, y: 0, width: 0, height: 0 };
  const [y0, x0, y1, x1] = b.map((v) => Math.min(1000, Math.max(0, v)) / 1000);
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

// Models in order of preference. Flash models work on Google's free plan; Pro needs billing turned on for the key
// (without it Pro answers 429 "quota exceeded" and we move on).
export const MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-pro-latest"];

/** Reads the pages with the first model that answers, retrying briefly when Gemini is busy. */
export async function extract(pages: Page[], apiKey: string, models = MODELS): Promise<Extraction> {
  let last: unknown;
  for (const model of models) {
    // Two tries per model: Gemini's "high demand" (503) and rate limits (429) usually clear within seconds.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await call(pages, apiKey, model);
      } catch (e) {
        last = e;
        // Only capacity/availability problems are worth retrying; bad input won't improve.
        if (!(e instanceof GeminiError) || ![404, 429, 500, 503].includes(e.status)) throw e;
        if (e.status === 404) break; // model not available to this key: try the next one
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
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
