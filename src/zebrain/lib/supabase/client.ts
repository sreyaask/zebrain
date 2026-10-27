import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// One Supabase client for the browser. Sessions live in cookies so server routes see the same user.
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  return client;
}
