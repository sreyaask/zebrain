"use client";
/**
 * Lightweight checks that don't load the Supabase library, so marketing pages stay small.
 * The full client (lib/api.ts) is only loaded on pages that need data, or on demand.
 */
export const live = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Supabase stores the session under "sb-<project-ref>-auth-token" in localStorage. */
function sessionKey(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

export function hasSavedSession(): boolean {
  const key = sessionKey();
  if (!key) return false;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const s = JSON.parse(raw) as { refresh_token?: string };
    return Boolean(s.refresh_token);
  } catch {
    return false;
  }
}

/** Calls back when the saved session changes in this tab (after login/logout) or another tab. */
export function watchSavedSession(cb: (signedIn: boolean) => void): () => void {
  const key = sessionKey();
  const check = () => cb(hasSavedSession());
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === key) check();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", check);
  window.addEventListener("penned:auth", check);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", check);
    window.removeEventListener("penned:auth", check);
  };
}

/** Signs out, loading the Supabase client only at that moment. */
export async function signOutLive() {
  const { signOut } = await import("./api");
  await signOut();
  window.dispatchEvent(new Event("penned:auth"));
}
