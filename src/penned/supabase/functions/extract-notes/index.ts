// extract-notes: reads photos / PDF pages of class notes with Google Gemini and returns everything on them, in reading
// order: headings, paragraphs, lists, equations, tables and diagrams (with where each diagram sits on the page, so the app
// can crop it for the pen plotter to trace exactly).
//
// Needs: the secret GEMINI_API_KEY on this function, and app_settings.ai_extraction = true. Otherwise it answers 503 and
// the iPhone app reads pages on the phone instead (ios/Penned/Services/TextRecognizer.swift).
//
// Request  (POST, signed-in customer's JWT in Authorization):
//   { "pages": [ { "media_type": "image/jpeg" | "image/png" | "application/pdf", "data": "<base64>" } ] }
//   Up to 10 images, or one PDF. Send pages in order.
// Response: { "text": "<Penned order text>", "diagrams": [ { id, page, box, description, svg } ], "pages": [ { page, blocks } ],
//             "formatted": ["<svg>…", …], "formatted_paths": ["<uid>/formatted/<batch>/page-1.svg", …] }
//   "formatted" are clean typeset pages (text + Gemini's diagram drawings) for the phone preview; they're also saved to the
//   customer's folder in the uploads bucket so the team and the plotter can use them.
//   "text" uses the order format the admin portal already understands: "# " headings, plain lines,
//   and "[[diagram:<id>]]" where each diagram goes. Boxes are 0-1 of the page, top-left origin.

import { createClient } from "npm:@supabase/supabase-js@2";
import { extractFast, extractPages, GeminiError, toOrder, type Page } from "./gemini.ts";
import { composeLayout, imageSize } from "./compose.ts";

const MAX_IMAGES = 10;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });

  // Signed-in customers only.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: user } = await userClient.auth.getUser();
  if (!user.user) return json(401, { error: "Please sign in." });

  // Switched off unless the team has turned it on and set a key.
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: flag } = await admin.from("app_settings").select("value").eq("key", "ai_extraction").maybeSingle();
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (flag?.value !== true || !apiKey) return json(503, { error: "AI reading is switched off.", code: "ai_extraction_off" });

  const body = await req.json().catch(() => null) as { pages?: Page[] } | null;
  const pages = body?.pages ?? [];
  const images = pages.filter((p) => p.media_type === "image/jpeg" || p.media_type === "image/png");
  const pdfs = pages.filter((p) => p.media_type === "application/pdf");
  if (!pages.length || images.length + pdfs.length !== pages.length) return json(400, { error: "Send JPEG/PNG images or one PDF." });
  if (images.length > MAX_IMAGES || pdfs.length > 1 || (pdfs.length && images.length)) {
    return json(400, { error: `Send up to ${MAX_IMAGES} images, or one PDF, per request.` });
  }

  try {
    // Images: one request per page, all at once. A PDF goes as one request (the app sends rendered pages when it can).
    const result = images.length ? await extractPages(images, apiKey) : await extractFast(pdfs, apiKey);
    const order = toOrder(result);
    const svgByBlock = result.pages.flatMap((p) => p.blocks.filter((b) => b.kind === "diagram").map((b) => b.svg));
    const diagrams = order.diagrams.map((d, i) => ({ ...d, svg: svgByBlock[i] ?? "" }));
    // Formatted pages keep the original layout: each block where it was, at the size it was written.
    const formatted = composeLayout(result, images.length ? images.map((p) => imageSize(p.data)) : result.pages.map(() => null));

    // Save the formatted pages next to the customer's uploads (best effort: the preview doesn't depend on it).
    const batch = crypto.randomUUID();
    const formatted_paths: string[] = [];
    await Promise.all(formatted.map(async (svg, i) => {
      const path = `${user.user!.id}/formatted/${batch}/page-${i + 1}.svg`;
      const { error } = await admin.storage.from("uploads").upload(path, new Blob([svg], { type: "image/svg+xml" }), { contentType: "image/svg+xml" });
      if (error) console.error(`saving ${path}: ${error.message}`);
      else formatted_paths[i] = path;
    }));
    return json(200, { text: order.text, diagrams, pages: result.pages, formatted, formatted_paths: formatted_paths.filter(Boolean) });
  } catch (error) {
    if (error instanceof GeminiError) {
      console.error(error.message);
      if (error.status === 429 || error.status === 503) return json(503, { error: "AI reading is busy. Try again in a minute." });
      if (error.status === 413) return json(413, { error: "Too much on these pages for one request. Send fewer pages." });
      return json(502, { error: "These pages couldn't be read automatically." });
    }
    console.error(error);
    return json(502, { error: "The reading came back incomplete. Try again." });
  }
});
