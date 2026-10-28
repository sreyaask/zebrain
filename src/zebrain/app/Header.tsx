"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { SoundToggle, ThemeToggle } from "./ui";

export default function Header() {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [path]);

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const name = (user?.user_metadata?.full_name as string | undefined) || user?.email || "";
  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const nav = (href: string, label: string) => (
    <Link href={href} className={`hover:text-paper ${path === href ? "text-paper" : ""}`}>{label}</Link>
  );

  return (
    // The home and sign-in pages sit on the dark beam, so the header stays dark there in both themes.
    <header className={`relative z-10 ${path === "/" || path === "/login" ? "dark-scope" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-[15px] font-medium tracking-tight">Zebrain.</Link>
        <nav className="flex items-center gap-3.5 whitespace-nowrap text-[13px] text-mute sm:gap-6 sm:text-sm">
          {user ? (
            <>
              {nav("/new", "New model")}
              {nav("/runs", "Runs")}
              {nav("/chat", "Chat")}
              <details ref={menu} className="relative">
                <summary className="flex cursor-pointer list-none items-center rounded-full outline-offset-4 [&::-webkit-details-marker]:hidden" aria-label="Account">
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-semibold uppercase text-white">{name.slice(0, 1)}</span>
                  )}
                </summary>
                <div className="absolute right-0 mt-3 w-56 rounded-xl border border-line bg-panel p-1.5 text-sm text-paper shadow-2xl">
                  <p className="truncate px-3 py-2 text-xs text-mute">{name}</p>
                  <Link href="/wallet" className="block rounded-lg px-3 py-2 hover:bg-line">Wallet</Link>
                  <Link href="/connect" className="block rounded-lg px-3 py-2 hover:bg-line">Kaggle and Hugging Face</Link>
                  <Link href="/fix" className="block rounded-lg px-3 py-2 hover:bg-line">Fix wrong answers</Link>
                  <Link href="/pricing" className="block rounded-lg px-3 py-2 hover:bg-line">Pricing</Link>
                  <div className="flex items-center justify-between px-3 py-1 text-mute sm:hidden">Sounds and theme <span className="flex"><SoundToggle /><ThemeToggle /></span></div>
                  <button onClick={signOut} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-line">Sign out</button>
                </div>
              </details>
            </>
          ) : user === null ? (
            <>
              {nav("/pricing", "Pricing")}
              {nav("/login", "Sign in")}
              <Link href="/login?mode=signup" className="btn px-4 py-1.5 text-[13px]">Sign up</Link>
            </>
          ) : null}
          {/* Signed in on a phone, these live in the account menu to keep the bar on one line. */}
          <span className={`-mx-1.5 items-center sm:-mx-3 ${user ? "hidden sm:flex" : "flex"}`}>
            <SoundToggle />
            <ThemeToggle />
          </span>
        </nav>
      </div>
    </header>
  );
}
