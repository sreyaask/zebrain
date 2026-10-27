import { NextResponse } from "next/server";
import { MissingKeys, supabaseAdmin } from "@/lib/server/admin";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabaseServer } from "@/lib/supabase/server";

// "Email me when you're back": one open request per email.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(`notify:${ip}`, 5, 3600_000)) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  const { email } = await req.json().catch(() => ({}));
  const e = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || e.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const { data: { user } } = await supabaseServer().auth.getUser();
  try {
    const { error } = await supabaseAdmin().from("service_waitlist").insert({ email: e, user_id: user?.id ?? null, service: "qwen" });
    if (error && !/duplicate|unique/i.test(error.message)) return NextResponse.json({ error: "Couldn't save your email." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof MissingKeys) return NextResponse.json({ error: "Couldn't save your email right now." }, { status: 503 });
    throw err;
  }
}
