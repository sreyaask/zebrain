"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { demoUser } from "@/lib/mock";
import { isSignedIn, setSignedIn } from "@/lib/store";
import { hasSavedSession, live, signOutLive, watchSavedSession } from "@/lib/session";
import { LinkButton } from "./Button";

const links = [
  { href: "/#products", label: "What we write" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/setup", label: "Handwriting" },
  { href: "/orders", label: "My orders" },
];

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("rounded font-serif text-[22px] font-medium tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", className)}
    >
      Penned
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSigned] = useState(false);

  useEffect(() => {
    if (live) {
      // Read the saved session directly so this page doesn't need the Supabase library.
      setSigned(hasSavedSession());
      return watchSavedSession(setSigned);
    }
    const sync = () => setSigned(isSignedIn());
    sync();
    window.addEventListener("penned:auth", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("penned:auth", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
    if (live) setSigned(hasSavedSession()); // e.g. after logging in and navigating
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/#products" ? pathname.startsWith("/products") : !href.startsWith("/#") && (pathname === href || pathname.startsWith(href + "/"));
  const initials = live ? "Me" : demoUser.name.split(" ").map((p) => p[0]).join("");
  const logOut = () => (live ? signOutLive() : setSignedIn(false));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Wordmark />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                isActive(l.href) ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <button
              type="button"
              onClick={logOut}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              title="Log out"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-xs font-medium text-ink" aria-hidden="true">
                {initials}
              </span>
              <span>Log out</span>
            </button>
          ) : (
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Log in
            </Link>
          )}
          <LinkButton href="/order/" size="sm">
            Get started
          </LinkButton>
        </div>
        <button
          type="button"
          className="-mr-2 rounded-lg p-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="animate-fade-in border-t border-line bg-paper md:hidden">
          <nav aria-label="Mobile" className="mx-auto flex max-w-6xl flex-col px-5 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className="rounded-lg px-2 py-3 text-[15px] text-ink hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {l.label}
              </Link>
            ))}
            {signedIn ? (
              <button type="button" onClick={logOut} className="rounded-lg px-2 py-3 text-left text-[15px] text-ink hover:bg-ink/5">
                Log out{live ? "" : ` (${demoUser.name})`}
              </button>
            ) : (
              <Link href="/login" className="rounded-lg px-2 py-3 text-[15px] text-ink hover:bg-ink/5">
                Log in
              </Link>
            )}
            <LinkButton href="/order/" className="mt-3" fullWidth>
              Get started
            </LinkButton>
          </nav>
        </div>
      )}
    </header>
  );
}
