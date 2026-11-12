"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type { DbProfile } from "@/lib/db";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";

const AdminContext = createContext<{ profile: DbProfile } | null>(null);
export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin outside AdminShell");
  return ctx;
};

const nav = [
  { href: "/admin/", label: "Orders", match: (p: string) => p === "/admin" || p.startsWith("/admin/order") },
  { href: "/admin/handwriting/", label: "Handwriting", match: (p: string) => p.startsWith("/admin/handwriting") },
];

type State = { kind: "loading" } | { kind: "signed-out" } | { kind: "not-admin"; email: string } | { kind: "ready"; profile: DbProfile; session: Session };

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = (usePathname() || "/admin").replace(/\/$/, "") || "/admin";
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = supabase();
    const load = async (session: Session | null) => {
      if (!session) return setState({ kind: "signed-out" });
      const { data } = await sb.from("profiles").select("id, full_name, phone, role").eq("id", session.user.id).single();
      if (!data || data.role !== "admin") return setState({ kind: "not-admin", email: session.user.email ?? "" });
      setState({ kind: "ready", profile: data as DbProfile, session });
    };
    sb.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => load(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (state.kind === "signed-out" && !isLogin) router.replace("/admin/login/");
    if (state.kind === "ready" && isLogin) router.replace("/admin/");
  }, [state.kind, isLogin, router]);

  if (!supabaseConfigured) {
    return (
      <Centered>
        <Alert tone="error" title="The admin portal isn't connected to Supabase">
          Copy <code>.env.example</code> to <code>.env.local</code>, add the project URL and publishable key, and restart the server.
        </Alert>
      </Centered>
    );
  }
  if (isLogin) return <>{children}</>;
  if (state.kind === "loading" || state.kind === "signed-out") {
    return (
      <Centered>
        <div className="flex items-center gap-2 text-sm text-muted" role="status">
          <Spinner className="h-4 w-4" /> Checking your session
        </div>
      </Centered>
    );
  }
  if (state.kind === "not-admin") {
    return (
      <Centered>
        <Alert tone="error" title="This account isn't an admin">
          {state.email} is signed in, but only admin accounts can open the portal. Ask an existing admin to give you access.
        </Alert>
        <button className="mt-4 text-sm text-accent underline-offset-4 hover:underline" onClick={() => supabase().auth.signOut()}>
          Sign out
        </button>
      </Centered>
    );
  }

  return (
    <AdminContext.Provider value={{ profile: state.profile }}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[220px_1fr]">
        <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">
          Skip to content
        </a>
        <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block">
            <Link href="/admin/" className="font-display text-xl font-light tracking-[0.12em] text-accent">
              penned<span className="text-ink">.</span> <span className="font-sans text-xs font-medium tracking-normal text-muted">Admin</span>
            </Link>
            <nav aria-label="Admin" className="flex gap-1 lg:mt-8 lg:flex-col">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={n.match(pathname) ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    n.match(pathname) ? "bg-paper font-medium text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-2 lg:absolute lg:bottom-5 lg:block lg:border-0 lg:py-0">
            <p className="truncate text-xs text-muted">{state.session.user.email}</p>
            <button onClick={() => supabase().auth.signOut()} className="mt-1 text-sm text-ink underline-offset-4 hover:underline">
              Sign out
            </button>
          </div>
        </aside>
        <main id="admin-main" className="min-w-0 px-5 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">{children}</div>;
}
