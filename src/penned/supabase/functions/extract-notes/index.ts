// extract-notes: reads photos / PDF pages of class notes with Claude and returns everything on them, in reading order:
// headings, paragraphs, lists, equations, tables and diagrams (with where each diagram sits on the page, so the app
// can crop it for the plotter to trace).
//
// OFF BY DEFAULT. It does nothing until BOTH are true:
//   1. the secret ANTHROPIC_API_KEY is set on the function:  supabase secrets set ANTHROPIC_API_KEY=...
//   2. app_settings.ai_extraction is true:                     update public.app_settings set value = 'true' where key = 'ai_extraction';
// Deploy when ready:  supabase functions deploy extract-notes
// Until then the iPhone app keeps reading pages on the phone (Apple Vision), see ios/Penned/Services/TextRecognizer.swift.
//
// Request  (POST, signed-in customer's JWT in Authorization):
//   { "pages": [ { "media_type": "image/jpeg" | "image/png" | "application/pdf", "data": "<base64>" } ] }
//   Up to 10 images, or one PDF (up to 100 pages). Send pages in order.
// Response: { "pages": [ { "page": 1, "blocks": [ ... ] } ], "text": "<Penned order text>", "diagrams": [ ... ] }
//   "text" uses the order format the admin portal already understands: "# " headings, plain lines,
//   and "[[diagram:<id>]]" where each diagram goes.

import Anthropic from "npm:@anthropic-ai/sdk";
import { z } from "npm:zod";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";
const MAX_IMAGES = 10;

const Box = z.object({
  x: z.number().describe("Left edge, 0-1 of page width"),
  y: z.number().describe("Top edge, 0-1 of page height"),
  width: z.number().describe("0-1 of page width"),
  height: z.number().describe("0-1 of page height"),
});

const Block = z.object({
  kind: z.enum(["heading", "paragraph", "list_item", "equation", "table", "diagram"]),
  text: z.string().describe("The exact words as written. Equations in plain text (e.g. F = m × a). Tables as rows separated by newlines and cells by ' | '. For a diagram: its labels, comma-separated."),
  level: z.number().describe("Heading level 1-3; 0 for anything that is not a heading"),
  description: z.string().describe("For a diagram: one sentence on what it shows. Empty for other kinds."),
  box: Box.describe("Where this block is on the page. Required and tight for diagrams; approximate for text."),
});

const Extraction = z.object({
  pages: z.array(z.object({
    page: z.number().describe("1-based page number in the order received"),
    blocks: z.array(Block).describe("Every block on the page in reading order"),
  })),
});
type Extraction = z.infer<typeof Extraction>;

const PROMPT = `These are pages of a student's class notes (photos or scans; handwritten or printed).
Copy out EVERYTHING on each page, in reading order, as blocks. Do not summarise, correct, translate or add anything;
keep the student's wording, spelling and numbering. Mark headings and their level. Keep list items as separate blocks.
Write equations in plain text. Treat drawings, graphs, labelled figures, circuit and flow diagrams, maps and tables of
symbols as "diagram" blocks with a tight box around the whole drawing including its labels. Ignore page numbers, the
notebook's printed ruling, margins, stains and the background. If a word is unreadable, write [?] in its place.`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });

  // Signed-in customers only.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: user } = await userClient.auth.getUser();
  if (!user.user) return json(401, { error: "Please sign in." });

  // Switched off unless the team has turned it on and set a key.
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: flag } = await admin.from("app_settings").select("value").eq("key", "ai_extraction").maybeSingle();
  if (flag?.value !== true || !Deno.env.get("ANTHROPIC_API_KEY")) {
    return json(503, { error: "AI reading is switched off.", code: "ai_extraction_off" });
  }

  const body = await req.json().catch(() => null) as { pages?: { media_type: string; data: string }[] } | null;
  const pages = body?.pages ?? [];
  const images = pages.filter((p) => p.media_type === "image/jpeg" || p.media_type === "image/png");
  const pdfs = pages.filter((p) => p.media_type === "application/pdf");
  if (!pages.length || images.length + pdfs.length !== pages.length) return json(400, { error: "Send JPEG/PNG images or one PDF." });
  if (images.length > MAX_IMAGES || pdfs.length > 1 || (pdfs.length && images.length)) {
    return json(400, { error: `Send up to ${MAX_IMAGES} images, or one PDF, per request.` });
  }

  const content: Anthropic.ContentBlockParam[] = [
    ...images.map((p): Anthropic.ImageBlockParam => ({
      type: "image",
      source: { type: "base64", media_type: p.media_type as "image/jpeg" | "image/png", data: p.data },
    })),
    ...pdfs.map((p): Anthropic.DocumentBlockParam => ({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: p.data },
    })),
    { type: "text", text: PROMPT },
  ];

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  try {
    // Structured output: the response is validated against the schema above. Streaming, because a long PDF can
    // produce a large answer. Server-side fallbacks re-run a declined request on Anthropic's recommended model.
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(Extraction) },
      messages: [{ role: "user", content }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") return json(422, { error: "These pages couldn't be read automatically." });
    if (message.stop_reason === "max_tokens") return json(413, { error: "Too much on these pages for one request. Send fewer pages." });

    const raw = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = Extraction.safeParse(JSON.parse(raw));
    if (!parsed.success) return json(502, { error: "The reading came back incomplete. Try again." });
    return json(200, { ...toOrder(parsed.data), pages: parsed.data.pages });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json(429, { error: "Busy right now. Try again in a minute." });
    if (error instanceof Anthropic.APIError) return json(502, { error: `AI reading failed (${error.status}).` });
    throw error;
  }
});

/** Turns blocks into Penned's order text, with a diagram id for each drawing the app should crop. */
function toOrder(x: Extraction) {
  const lines: string[] = [];
  const diagrams: { id: string; page: number; box: z.infer<typeof Box>; description: string }[] = [];
  for (const p of x.pages) {
    for (const b of p.blocks) {
      if (b.kind === "diagram") {
        const id = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
        diagrams.push({ id, page: p.page, box: b.box, description: b.description });
        lines.push(`[[diagram:${id}]]`);
      } else if (b.kind === "heading") {
        lines.push(`# ${b.text.trim()}`);
      } else if (b.kind === "list_item") {
        lines.push(b.text.trim().match(/^([-•*]|\d+[.)])\s/) ? b.text.trim() : `- ${b.text.trim()}`);
      } else {
        lines.push(...b.text.split("\n").map((l) => l.trim()).filter(Boolean));
      }
    }
    lines.push("");
  }
  return { text: lines.join("\n").trim(), diagrams };
}
