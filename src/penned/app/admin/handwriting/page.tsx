"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DbHandwriting, HandwritingStatus } from "@/lib/db";
import { timeAgo } from "@/lib/adminData";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

const label: Record<HandwritingStatus, string> = { uploaded: "Needs review", processing: "In review", ready: "Approved", needs_rescan: "Rescan requested" };

export default function HandwritingList() {
  const [rows, setRows] = useState<(DbHandwriting & { profiles: { full_name: string } | null })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase()
      .from("handwriting_profiles")
      .select("id, user_id, name, ink, status, scan_path, missing_chars, review_note, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) setError(error.message);
    else setRows(data as never);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const pending = rows?.filter((r) => r.status === "uploaded").length ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Handwriting</h1>
      <p className="mt-1 text-sm text-muted">{rows ? `${pending} waiting for review` : "Loading"}</p>
      {error ? (
        <Alert tone="error" className="mt-6" title="Couldn't load styles">{error}</Alert>
      ) : rows === null ? (
        <div className="mt-6 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No handwriting samples yet. They appear here when customers scan their sheet in the app.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/handwriting/review/?id=${r.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                <span>
                  <span className={cn("font-hand text-2xl leading-none", r.ink === "blue" ? "text-pen-blue" : "text-pen-black")}>{r.name}</span>
                  <span className="mt-1 block text-xs text-muted">Uploaded {timeAgo(r.created_at)}{r.missing_chars ? ` · missing ${r.missing_chars}` : ""}</span>
                </span>
                <span className={cn("text-sm", r.status === "uploaded" ? "font-medium text-accent" : r.status === "needs_rescan" ? "text-danger" : "text-muted")}>
                  {label[r.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
