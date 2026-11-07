"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { DbHandwriting } from "@/lib/db";
import { loadImagePixels } from "@/lib/adminData";
import { binarize, extractGlyphs, layoutHandwriting, pageSpecFor, pageToSvg, SHEET_LINES, expectedChars, type ExtractResult } from "@/lib/engine/index.ts";
import { samplePreviewText } from "@/lib/mock";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Skeleton, Spinner } from "@/components/ui/Spinner";
import { GlyphPreview } from "@/components/admin/GlyphPreview";

const sheetOrder = Array.from(new Set(SHEET_LINES.flatMap((l) => expectedChars(l))));

function Review() {
  const id = useSearchParams().get("id");
  const [row, setRow] = useState<DbHandwriting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<{ url: string; width: number; height: number } | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [busy, setBusy] = useState<"extract" | "approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase().from("handwriting_profiles").select("*").eq("id", id).maybeSingle();
    if (error || !data) return setError(error?.message ?? "This handwriting style doesn't exist.");
    setRow(data as DbHandwriting);
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const extract = async () => {
    if (!row) return;
    setBusy("extract");
    setError(null);
    try {
      const img = await loadImagePixels("handwriting", row.scan_path);
      setScan({ url: img.objectUrl, width: img.width, height: img.height });
      // Let the spinner paint before the heavy work.
      await new Promise((r) => setTimeout(r, 30));
      setResult(extractGlyphs(binarize(img.pixels, img.width, img.height)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't process the scan.");
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    if (!row || !result) return;
    setBusy("approve");
    const { error } = await supabase()
      .from("handwriting_profiles")
      .update({ status: "ready", glyph_set: result.glyphSet, missing_chars: result.missing.join(""), review_note: null })
      .eq("id", row.id);
    setBusy(null);
    if (error) setError(error.message);
    else {
      setDone("Approved. The customer can now order in this style.");
      load();
    }
  };

  const reject = async () => {
    if (!row) return;
    if (!note.trim()) return setError("Tell the customer what to fix, so they can rescan.");
    setBusy("reject");
    const { error } = await supabase().from("handwriting_profiles").update({ status: "needs_rescan", review_note: note.trim() }).eq("id", row.id);
    setBusy(null);
    if (error) setError(error.message);
    else {
      setDone("Rescan requested. The customer sees your note in the app.");
      load();
    }
  };

  if (!id) return <Alert tone="error" title="No style selected" />;
  if (!row) return error ? <Alert tone="error" title="Couldn't open this style">{error}</Alert> : <Skeleton className="h-64 w-full max-w-4xl" />;

  const okLines = result?.lines.filter((l) => l.ok).length ?? 0;
  const preview = result
    ? (() => {
        const spec = pageSpecFor({ widthMm: 148, heightMm: 105 }, 10, 1.2);
        const lay = layoutHandwriting(`# Preview\n${samplePreviewText}`, result.glyphSet, spec, { headingStyle: "underline", seed: row.id });
        return lay.pages[0] ? pageToSvg(lay.pages[0], row.ink, { ruled: true, pitchMm: spec.linePitchMm, topMm: spec.topMm }) : null;
      })()
    : null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/handwriting/" className="text-sm text-muted hover:text-ink">← Handwriting</Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{row.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {row.ink} ink · status {row.status.replace("_", " ")}
        {row.review_note ? ` · note: ${row.review_note}` : ""}
      </p>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      {done && <Alert tone="success" className="mt-4">{done}</Alert>}

      {!result ? (
        <div className="mt-8">
          <p className="max-w-prose text-sm text-muted">
            Extraction reads the photographed sheet, finds each written line, cuts out every character and turns it into pen strokes. It runs in your browser and takes a few seconds.
          </p>
          <Button className="mt-4" onClick={extract} loading={busy === "extract"}>
            {busy === "extract" ? "Reading the sheet" : "Extract handwriting"}
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <section aria-labelledby="sheet-h">
            <h2 id="sheet-h" className="text-base font-semibold">Sheet</h2>
            <p className="mt-1 text-sm text-muted">
              {okLines} of {result.lines.length} written lines matched. Boxes show what each mark was read as; red boxes were skipped.
            </p>
            {scan && (
              <div className="relative mt-3 overflow-hidden rounded border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scan.url} alt="The customer's handwriting sheet" className="block w-full" />
                <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${scan.width} ${scan.height}`} preserveAspectRatio="none" aria-hidden="true">
                  {result.marks.map((m, i) => (
                    <g key={i}>
                      <rect x={m.box.x0} y={m.box.y0} width={m.box.x1 - m.box.x0} height={m.box.y1 - m.box.y0} fill="none" stroke={m.char ? "#1E3A8A" : "#B42318"} strokeWidth={Math.max(1, scan.width / 900)} opacity={0.7} />
                      {m.char && <text x={m.box.x0} y={m.box.y0 - 3} fontSize={Math.max(10, scan.width / 90)} fill="#1E3A8A">{m.char}</text>}
                    </g>
                  ))}
                </svg>
              </div>
            )}
            {result.lines.some((l) => !l.ok) && (
              <ul className="mt-3 space-y-1 text-sm text-danger">
                {result.lines.filter((l) => !l.ok).map((l) => (
                  <li key={l.index}>Line {l.index + 1}: expected {l.expected} characters, found {l.found}. Skipped.</li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="glyph-h">
            <h2 id="glyph-h" className="text-base font-semibold">Characters</h2>
            <p className="mt-1 text-sm text-muted">
              {result.missing.length ? `Missing: ${result.missing.join(" ")}` : "Every character on the sheet has at least one sample."}
            </p>
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-px overflow-hidden rounded border border-line bg-line">
              {sheetOrder.map((c) => {
                const samples = result.glyphSet.glyphs[c] ?? [];
                return (
                  <div key={c} className="flex flex-col items-center bg-surface p-2">
                    <span className="self-start font-mono text-[11px] text-muted">{c} <span className="tabular-nums">×{samples.length}</span></span>
                    {samples[0] ? <GlyphPreview glyph={samples[0]} /> : <span className="flex h-14 items-center text-xs text-danger">none</span>}
                  </div>
                );
              })}
            </div>
          </section>

          {preview && (
            <section aria-labelledby="prev-h">
              <h2 id="prev-h" className="text-base font-semibold">Written preview</h2>
              <div className="mt-3 max-w-xl overflow-hidden rounded border border-line bg-white" dangerouslySetInnerHTML={{ __html: preview.replace(/width="[^"]+mm" height="[^"]+mm"/, 'width="100%" height="auto"') }} />
            </section>
          )}

          <section aria-labelledby="decide-h" className="border-t border-line pt-6">
            <h2 id="decide-h" className="text-base font-semibold">Decision</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <Button onClick={approve} loading={busy === "approve"} disabled={result.missing.length > 10}>Approve this style</Button>
                {result.missing.length > 10 && <p className="mt-2 text-sm text-muted">Too many characters are missing to approve. Ask for a rescan.</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="note" className="block text-sm font-medium">Ask for a rescan</label>
                <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Letters are joined on line 2. Please write each letter separately." className="block w-full rounded-xl border border-line bg-surface p-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25" />
                <Button variant="secondary" onClick={reject} loading={busy === "reject"}>Send to customer</Button>
              </div>
            </div>
          </section>
        </div>
      )}
      {busy === "extract" && <span className="sr-only" role="status"><Spinner /> Reading the sheet</span>}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <Review />
    </Suspense>
  );
}
