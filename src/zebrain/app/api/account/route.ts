import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Which accounts are connected, as yes/no only: saved keys are read here on the server and never sent to the browser.
export async function GET() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ account: null });
  const { data } = await sb.from("connections").select("kaggle_user, hf_user, kaggle_key, hf_token").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({
    account: {
      connected: !!(data?.kaggle_user && data.kaggle_key && data.hf_token),
      kaggleUser: data?.kaggle_user ?? undefined,
      hfUser: data?.hf_user ?? undefined,
    },
  });
}
