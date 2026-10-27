import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Public: is Zebrain's Qwen service up? (read under row-level security; no keys needed)
export async function GET() {
  const { data } = await supabaseServer().from("service_status").select("service, up, since").eq("service", "qwen").maybeSingle();
  return NextResponse.json({ qwen: data ?? { service: "qwen", up: true, since: null } });
}
