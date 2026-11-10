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
// Response: { "text": "<Penned order text>", "diagrams": [ { id, page, box, description } ], "pages": [ { page, blocks } ] }
//   "text" uses the order format the admin portal already understands: "# " headings, plain lines,
//   and "[[diagram:<id>]]" where each diagram goes. Boxes are 0-1 of the page, top-left origin.

import { createClient } from "npm:@supabase/supabase-js@2";
import { extract, GeminiError, toOrder, type Page } from "./gemini.ts";

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
    const result = await extract(pages, apiKey);
    return json(200, { ...toOrder(result), pages: result.pages });
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
