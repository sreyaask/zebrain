import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Google sign-in lands here with a one-time code; swap it for a session, then continue.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const dest = next?.startsWith("/") && !next.startsWith("//") ? next : "/new";
  if (code) {
    const { error } = await supabaseServer().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(dest, url.origin));
  }
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Google sign-in didn't finish. Try again.")}`, url.origin));
}
