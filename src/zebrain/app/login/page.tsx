"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type AuthSettings = { external?: Record<string, boolean>; mailer_autoconfirm?: boolean };

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(params.get("error") ?? "");
  const [settings, setSettings] = useState<AuthSettings | null>(null);

  // Public auth settings: which providers are on, and whether sign-ups skip email confirmation.
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
    })
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setSettings({}));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const sb = supabase();
    try {
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name.trim() || undefined } } });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is still on in Supabase: try signing straight in anyway.
          const { error: e2 } = await sb.auth.signInWithPassword({ email, password });
          if (e2) throw new Error("Your account was made, but Supabase is still asking for email confirmation. Turn it off in Supabase → Authentication → Sign In / Providers → Email → Confirm email.");
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push(next);
      router.refresh();
    } catch (e) {
      setErr(friendly(e instanceof Error ? e.message : String(e)));
      setBusy(false);
    }
  }

  async function google() {
    setErr("");
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setErr(friendly(error.message));
  }

  const googleOn = settings?.external?.google;
  return (
    <main className="beam -mt-[60px] min-h-[calc(100vh)] px-4 pb-16 pt-[60px]">
      <div className="mx-auto max-w-sm pt-16 md:pt-24">
        <h1 className="mb-2 text-center text-[28px] font-medium leading-tight tracking-tight">
          {mode === "signup" ? <>Make your <span className="pixel">first</span> model</> : <>Welcome <span className="pixel">back</span></>}
        </h1>
        <p className="mb-8 text-center text-sm text-paper/70">
          {mode === "signup" ? "Free. No card, no email confirmation." : "Sign in to train, chat with and fix your models."}
        </p>

        <div className="rounded-2xl border border-white/10 bg-black/60 p-5 backdrop-blur-md">
          <button type="button" onClick={google} disabled={settings !== null && !googleOn} className="btn-ghost w-full bg-white text-ink hover:bg-white/90">
            <GoogleMark /> Continue with Google
          </button>
          {settings !== null && !googleOn && (
            <p className="mt-2 text-center text-xs text-mute">Google sign-in isn&apos;t switched on yet. Use email for now.</p>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-mute" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pw">Password</label>
              <input id="pw" type="password" required minLength={6} className="input" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <p role="alert" className="text-sm text-bad">{err}</p>}
            <button className="btn w-full" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}</button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-paper/70">
          {mode === "signup" ? "Already have an account? " : "New to Zebrain? "}
          <button className="link text-paper" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(""); }}>
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
        <p className="mt-2 text-center text-xs text-mute"><Link href="/" className="link">Back to home</Link></p>
      </div>
    </main>
  );
}

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/new";
}

function friendly(m: string) {
  if (/invalid login credentials/i.test(m)) return "That email and password don't match. Try again, or create an account.";
  if (/already registered|already exists/i.test(m)) return "There's already an account with that email. Sign in instead.";
  if (/password should be/i.test(m)) return "Use a password of at least 6 characters.";
  if (/rate limit/i.test(m)) return "Too many tries. Wait a minute and try again.";
  if (/provider is not enabled/i.test(m)) return "Google sign-in isn't switched on yet. Use email for now.";
  return m;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.57-5.15 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}
