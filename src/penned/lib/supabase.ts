"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client. Uses the project's publishable (anon) key, which is safe in the
 * browser because every table is protected by row-level security.
 * Configure in .env.local:  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
