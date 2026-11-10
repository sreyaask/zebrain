"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Select } from "@/components/ui/Input";
import {
  binarize, layoutHandwriting, svgToDrawing, withHandwrittenLabels, pageSpecFor, pageToSvg, pagesToGcode, estimateMinutes, plotterPresets, traceDiagram, DIAGRAM_LINE,
  type Diagram, type GlyphSet, type LayoutResult, type PageSpec, type PlotterSettings,
} from "@/lib/engine/index.ts";
import { getPageSize } from "@/lib/mock";
import type { DbOrder, DbOrderFile } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { loadImagePixels } from "@/lib/adminData";

type PresetId = keyof typeof plotterPresets;

interface Props {
  order: DbOrder;
  text: string;
  glyphSet: GlyphSet | null;
  /** The order's uploaded files; diagram crops are named diagram-<id>.png. */
  files: DbOrderFile[];
  onSaved: () => void;
}

/** Page geometry: the customer's own notebook when they measured it, otherwise the standard size. */
function specFor(order: DbOrder): PageSpec {
  const n = order.notebook_spec;
  const num = (v: unknown, lo: number, hi: number) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= lo && x <= hi ? x : null;
  };
  const w = num(n?.width_mm, 50, 400), h = num(n?.height_mm, 50, 500);
  // Only plausible measurements (the database checks these too); anything else uses the standard page.
  if (order.notebook_source === "own" && w && h) {
    const pitch = num(n?.line_pitch_mm, 3, 20) ?? 7.2 * Number(order.line_spacing);
    const margin = Math.min(num(n?.margin_mm, 0, 60) ?? Number(order.margin_mm), w - 40);
    return {
      widthMm: w,
      heightMm: h,
      marginLeftMm: Math.max(0, margin),
      marginRightMm: 8,
      topMm: pitch * 2,
      bottomMm: 10,
      linePitchMm: pitch,
      xHeightMm: Math.min(2.6, pitch * 0.36),
    };
  }
  return pageSpecFor(getPageSize(order.page_size), Number(order.margin_mm), Number(order.line_spacing));
}

/** Generates handwriting pages for an order and exports SVG + G-code for the plotter. */
export function PlotterPanel({ order, text, glyphSet, files, onSaved }: Props) {
  const [preset, setPreset] = useState<PresetId>("z-axis");
  const [settings, setSettings] = useState<PlotterSettings>(plotterPresets["z-axis"].settings);
  const [result, setResult] = useState<LayoutResult | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const spec = useMemo(() => specFor(order), [order]);
  const ruled = order.paper === "ruled-notebook";

  /** Downloads and traces every diagram the text refers to. */
  const loadDiagrams = async (): Promise<Record<string, Diagram>> => {
    const ids = Array.from(new Set(text.split("\n").map((l) => l.trim().match(DIAGRAM_LINE)?.[1]).filter((x): x is string => !!x)));
    const out: Record<string, Diagram> = {};
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      // Gemini's clean SVG drawing when there is one (exact shapes; labels written in the customer's hand),
      // otherwise the cropped photo, traced.
      const svgFile = files.find((f) => f.path.endsWith(`diagram-${id}.svg`));
      if (svgFile && glyphSet) {
        setPreparing(`Drawing diagram ${i + 1} of ${ids.length}`);
        try {
          const { data: blob } = await supabase().storage.from("uploads").download(svgFile.path);
          const drawing = blob ? svgToDrawing(await blob.text()) : null;
          if (drawing && drawing.strokes.length) {
            out[id] = withHandwrittenLabels(drawing, glyphSet);
            continue;
          }
        } catch {
          /* fall back to the photo below */
        }
      }
      const file = files.find((f) => f.path.endsWith(`diagram-${id}.png`));
      if (!file) continue;
      setPreparing(`Tracing diagram ${i + 1} of ${ids.length}`);
      try {
        const img = await loadImagePixels("uploads", file.path, 1600);
        out[id] = traceDiagram(binarize(img.pixels, img.width, img.height));
      } catch {
        /* reported as missing below */
      }
    }
    return out;
  };

  const generate = async () => {
    setMessage(null);
    if (!glyphSet) return;
    const diagrams = await loadDiagrams();
    setPreparing(null);
    let r: LayoutResult;
    try {
      // Cards: the same text on every card.
      r = layoutHandwriting(text, glyphSet, spec, { headingStyle: order.heading_style, seed: order.code, diagrams });
      if (order.paper === "premium-card" && order.copies > 1) {
        const one = r.pages;
        r.pages = Array.from({ length: order.copies }, (_, c) =>
          layoutHandwriting(text, glyphSet, spec, { headingStyle: order.heading_style, seed: `${order.code}-${c}`, diagrams }).pages[0] ?? one[0],
        );
      }
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Couldn't lay out these pages." });
      return;
    }
    setResult(r);
    setPageIdx(0);
  };

  const svg = result?.pages[pageIdx] ? pageToSvg(result.pages[pageIdx], order.ink, { ruled, pitchMm: spec.linePitchMm, topMm: spec.topMm }) : null;

  const save = async () => {
    if (!result) return;
    setSaving(true);
    setMessage(null);
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const base = `${order.id}/${stamp}`;
      const sb = supabase();
      const gcode = pagesToGcode(result.pages, settings, { orderCode: order.code });
      const up = async (path: string, body: string, type: string) => {
        const { error } = await sb.storage.from("plotter").upload(path, new Blob([body], { type }), { contentType: type });
        if (error) throw new Error(error.message);
      };
      await up(`${base}/job.gcode`, gcode, "text/plain");
      for (let i = 0; i < result.pages.length; i++)
        await up(`${base}/page-${String(i + 1).padStart(3, "0")}.svg`, pageToSvg(result.pages[i], order.ink), "image/svg+xml");
      const { error } = await sb.from("plotter_jobs").insert({
        order_id: order.id,
        page_count: result.pages.length,
        svg_path: `${base}/`,
        gcode_path: `${base}/job.gcode`,
        settings: { preset, ...settings },
      });
      if (error) throw new Error(error.message);
      setMessage({ tone: "success", text: `Saved ${result.pages.length} page(s) and the G-code file.` });
      onSaved();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Saving failed." });
    } finally {
      setSaving(false);
    }
  };

  const download = (name: string, body: string, type: string) => {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!glyphSet) {
    return <p className="text-sm text-muted">Pick a handwriting style that has been reviewed and approved to generate pages.</p>;
  }

  const paidUnits = order.paper === "premium-card" ? order.copies : order.billable_units;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Plotter"
          value={preset}
          onChange={(e) => {
            const id = e.target.value as PresetId;
            setPreset(id);
            setSettings(plotterPresets[id].settings);
          }}
        >
          {Object.entries(plotterPresets).map(([id, p]) => (
            <option key={id} value={id}>{p.label}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Draw speed (mm/min)" value={settings.drawFeed} onChange={(v) => setSettings({ ...settings, drawFeed: v })} />
          <NumField label="X offset (mm)" value={settings.offsetXMm} onChange={(v) => setSettings({ ...settings, offsetXMm: v })} />
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">Pen commands</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <TextField label="Pen up" value={settings.penUp} onChange={(v) => setSettings({ ...settings, penUp: v })} />
          <TextField label="Pen down" value={settings.penDown} onChange={(v) => setSettings({ ...settings, penDown: v })} />
          <NumField label="Y offset (mm)" value={settings.offsetYMm} onChange={(v) => setSettings({ ...settings, offsetYMm: v })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.flipY} onChange={(e) => setSettings({ ...settings, flipY: e.target.checked })} className="h-4 w-4 accent-[#1E3A8A]" />
            Origin at bottom-left (flip Y)
          </label>
        </div>
      </details>

      <Button onClick={() => void generate()} disabled={!text.trim() || !!preparing}>
        {preparing ?? (result ? "Regenerate pages" : "Generate pages")}
      </Button>
      {!text.trim() && <p className="text-sm text-muted">Add the text to write first.</p>}

      {result && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <div><dt className="text-muted">Pages</dt><dd className="tabular-nums">{result.pages.length}</dd></div>
            <div><dt className="text-muted">Paid for</dt><dd className="tabular-nums">{paidUnits}</dd></div>
            <div><dt className="text-muted">Lines</dt><dd className="tabular-nums">{result.lines}</dd></div>
            <div><dt className="text-muted">Plot time</dt><dd className="tabular-nums">~{Math.ceil(estimateMinutes(result.pages, settings))} min</dd></div>
          </dl>
          {order.paper !== "premium-card" && result.pages.length > paidUnits && (
            <Alert tone="error" title="More pages than the customer paid for">
              The layout needs {result.pages.length} pages but the order covers {paidUnits}. Tighten spacing or margins, or contact the customer before writing.
            </Alert>
          )}
          {result.missingDiagrams.length > 0 && (
            <Alert tone="error" title="Some diagrams could not be loaded">
              Space was left for {result.missingDiagrams.length === 1 ? "1 diagram" : `${result.missingDiagrams.length} diagrams`} ({result.missingDiagrams.join(", ")}). Draw them by hand or ask the customer to re-upload.
            </Alert>
          )}
          {result.missing.length > 0 && (
            <Alert tone="error" title="Some characters have no handwriting sample">
              These will be left blank: {result.missing.map((c) => `"${c}"`).join(" ")}. Edit the text or ask the customer to rescan.
            </Alert>
          )}
          {svg && (
            <figure>
              <div className="mx-auto max-w-md overflow-hidden rounded border border-line bg-white" dangerouslySetInnerHTML={{ __html: svg.replace(/width="[^"]+mm" height="[^"]+mm"/, 'width="100%" height="auto"') }} />
              <figcaption className="mt-3 flex items-center justify-center gap-3 text-sm">
                <Button size="sm" variant="secondary" disabled={pageIdx === 0} onClick={() => setPageIdx(pageIdx - 1)}>Previous</Button>
                <span className="tabular-nums text-muted">Page {pageIdx + 1} of {result.pages.length}</span>
                <Button size="sm" variant="secondary" disabled={pageIdx >= result.pages.length - 1} onClick={() => setPageIdx(pageIdx + 1)}>Next</Button>
              </figcaption>
            </figure>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} loading={saving}>Save job to Supabase</Button>
            <Button variant="secondary" onClick={() => download(`${order.code}.gcode`, pagesToGcode(result.pages, settings, { orderCode: order.code }), "text/plain")}>Download G-code</Button>
            <Button variant="secondary" onClick={() => result.pages[pageIdx] && download(`${order.code}-page-${pageIdx + 1}.svg`, pageToSvg(result.pages[pageIdx], order.ink), "image/svg+xml")}>Download this page (SVG)</Button>
          </div>
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface px-3 tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25" />
    </label>
  );
}
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface px-3 font-mono text-[13px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25" />
    </label>
  );
}
