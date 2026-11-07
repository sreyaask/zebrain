"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { statusFlow, statusLabel, type DbHandwriting, type DbOrder, type DbOrderEvent, type DbOrderFile, type DbPlotterJob } from "@/lib/db";
import { getPageSize, getPaper, timeSlots } from "@/lib/mock";
import { rupees } from "@/lib/format";
import { signedUrl } from "@/lib/adminData";
import { extractText } from "@/lib/ocr";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Spinner";
import { StatusPill } from "@/components/ui/StatusPill";
import { PlotterPanel } from "@/components/admin/PlotterPanel";

interface Loaded {
  order: DbOrder;
  files: DbOrderFile[];
  events: DbOrderEvent[];
  jobs: DbPlotterJob[];
  styles: DbHandwriting[];
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function OrderDetail() {
  const id = useSearchParams().get("id");
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [styleId, setStyleId] = useState<string>("");
  const [savingText, setSavingText] = useState(false);
  const [ocr, setOcr] = useState<{ fraction: number; label: string } | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [fulfil, setFulfil] = useState({ pages_written: 0, rider_name: "", eta: "", admin_note: "" });
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    const sb = supabase();
    const { data: order, error } = await sb.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) return setError(error.message);
    if (!order) return setError("This order doesn't exist, or you don't have access to it.");
    const [files, events, jobs, styles] = await Promise.all([
      sb.from("order_files").select("*").eq("order_id", id).order("created_at"),
      sb.from("order_events").select("*").eq("order_id", id).order("created_at"),
      sb.from("plotter_jobs").select("*").eq("order_id", id).order("created_at", { ascending: false }),
      sb.from("handwriting_profiles").select("*").eq("user_id", order.user_id).order("created_at", { ascending: false }),
    ]);
    const o = order as DbOrder;
    setData({ order: o, files: (files.data ?? []) as DbOrderFile[], events: (events.data ?? []) as DbOrderEvent[], jobs: (jobs.data ?? []) as DbPlotterJob[], styles: (styles.data ?? []) as DbHandwriting[] });
    setText((t) => t || o.source_text);
    setStyleId((s) => s || o.handwriting_profile_id || (styles.data ?? []).find((x: DbHandwriting) => x.status === "ready")?.id || "");
    setFulfil({ pages_written: o.pages_written, rider_name: o.rider_name ?? "", eta: o.eta ?? "", admin_note: o.admin_note ?? "" });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!id) return <Alert tone="error" title="No order selected">Open an order from the queue.</Alert>;
  if (error) return (
    <div className="max-w-lg space-y-3">
      <Alert tone="error" title="Couldn't open this order">{error}</Alert>
      <Link href="/admin/" className="text-sm text-accent underline-offset-4 hover:underline">Back to orders</Link>
    </div>
  );
  if (!data) return (
    <div className="max-w-5xl space-y-3" role="status" aria-label="Loading order">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" />
    </div>
  );

  const { order, files, events, jobs, styles } = data;
  const style = styles.find((s) => s.id === styleId) ?? null;
  const flowIdx = statusFlow.indexOf(order.status as (typeof statusFlow)[number]);
  const next = flowIdx >= 0 && flowIdx < statusFlow.length - 1 ? statusFlow[flowIdx + 1] : null;
  const units = order.paper === "premium-card" ? order.copies : order.billable_units;

  const update = async (patch: Partial<DbOrder>) => {
    setUpdating(true);
    const { error } = await supabase().from("orders").update(patch).eq("id", order.id);
    setUpdating(false);
    if (error) setError(error.message);
    else load();
  };

  const saveText = async () => {
    setSavingText(true);
    await update({ source_text: text, handwriting_profile_id: styleId || null });
    setSavingText(false);
  };

  const runOcr = async () => {
    setOcrError(null);
    setOcr({ fraction: 0, label: "Downloading files" });
    try {
      const blobs = [];
      for (const f of files) {
        const { data: blob, error } = await supabase().storage.from("uploads").download(f.path);
        if (error || !blob) throw new Error(`Couldn't download ${f.path.split("/").pop()}`);
        blobs.push({ blob, kind: f.kind });
      }
      const out = await extractText(blobs, (fraction, label) => setOcr({ fraction, label }));
      setText((t) => (t.trim() ? `${t.trim()}\n${out}` : out));
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : "Text extraction failed.");
    } finally {
      setOcr(null);
    }
  };

  const openFile = async (bucket: string, path: string) => {
    try {
      window.open(await signedUrl(bucket, path), "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open file");
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/" className="text-sm text-muted hover:text-ink">← Orders</Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs text-muted">{order.code}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{order.title || "Untitled order"}</h1>
          <p className="mt-1 text-sm text-muted">
            {order.paper === "premium-card" ? `${order.copies} cards` : `${order.page_count} ${order.page_count === 1 ? "page" : "pages"} (billed ${order.billable_units})`} · {getPaper(order.paper).name} ·{" "}
            {getPageSize(order.page_size).label} · {order.ink} ink · {rupees(order.total)}{" "}
            <span className={order.payment_status === "paid" ? "" : "text-danger"}>({order.payment_status})</span>
          </p>
        </div>
        {order.status === "cancelled" ? <span className="text-sm text-muted">Cancelled</span> : <StatusPill status={order.status} label={statusLabel[order.status]} />}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <Section
            title="Text to write"
            action={files.length > 0 && (
              <Button size="sm" variant="secondary" onClick={runOcr} loading={!!ocr}>
                Read text from {files.length === 1 ? "file" : `${files.length} files`}
              </Button>
            )}
          >
            {files.length > 0 && (
              <ul className="mb-4 flex flex-wrap gap-2 text-sm">
                {files.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => openFile("uploads", f.path)} className="rounded-lg border border-line bg-surface px-2.5 py-1 hover:border-ink/30">
                      {f.path.split("/").pop()} <span className="text-muted">· {f.pages}p</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {ocr && (
              <div className="mb-4" role="status" aria-live="polite">
                <p className="text-sm text-muted">{ocr.label}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(ocr.fraction * 100)}%` }} />
                </div>
              </div>
            )}
            {ocrError && <Alert tone="error" className="mb-4">{ocrError}</Alert>}
            <label htmlFor="source" className="sr-only">Text to write</label>
            <textarea
              id="source"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="block w-full rounded-xl border border-line bg-surface p-3.5 font-mono text-[13px] leading-relaxed focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              placeholder="Text read from the customer's pages appears here. Lines starting with # are headings."
            />
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block text-sm">
                <span className="font-medium">Handwriting style</span>
                <select
                  value={styleId}
                  onChange={(e) => setStyleId(e.target.value)}
                  className="mt-1.5 block h-10 rounded-xl border border-line bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                >
                  <option value="">Choose a style</option>
                  {styles.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.status !== "ready"}>
                      {s.name} {s.status !== "ready" ? `(${s.status.replace("_", " ")})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="secondary" onClick={saveText} loading={savingText}>Save text and style</Button>
            </div>
            {styles.length === 0 && <p className="mt-2 text-sm text-muted">This customer hasn&apos;t uploaded a handwriting sample yet.</p>}
            {style && style.status !== "ready" && (
              <p className="mt-2 text-sm text-muted">
                &ldquo;{style.name}&rdquo; isn&apos;t approved yet. <Link className="text-accent underline-offset-4 hover:underline" href={`/admin/handwriting/review/?id=${style.id}`}>Review it</Link>.
              </p>
            )}
          </Section>

          <Section title="Plotter output">
            <PlotterPanel order={order} text={text} glyphSet={style?.status === "ready" ? style.glyph_set : null} onSaved={load} />
            {jobs.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium">Saved jobs</h3>
                <ul className="mt-2 divide-y divide-line text-sm">
                  {jobs.map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-muted">{new Date(j.created_at).toLocaleString("en-IN")} · {j.page_count} pages</span>
                      <button onClick={() => openFile("plotter", j.gcode_path)} className="text-accent underline-offset-4 hover:underline">G-code</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-8 lg:border-l lg:border-line lg:pl-8">
          <div>
            <h2 className="text-sm font-semibold">Status</h2>
            <div className="mt-3 space-y-3">
              {next && (
                <Button fullWidth onClick={() => update({ status: next, ...(next === "quality_check" ? { pages_written: units } : {}) })} loading={updating}>
                  Mark as {statusLabel[next].toLowerCase()}
                </Button>
              )}
              {order.status === "writing" && (
                <div className="flex items-end gap-2">
                  <Input
                    label={`Pages written (of ${units})`}
                    type="number"
                    min={0}
                    max={units}
                    value={fulfil.pages_written}
                    onChange={(e) => setFulfil({ ...fulfil, pages_written: Math.max(0, Math.min(units, Number(e.target.value) || 0)) })}
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={() => update({ pages_written: fulfil.pages_written })}>Save</Button>
                </div>
              )}
              {(order.status === "quality_check" || order.status === "out_for_delivery") && (
                <div className="space-y-2">
                  <Input label="Rider" value={fulfil.rider_name} onChange={(e) => setFulfil({ ...fulfil, rider_name: e.target.value })} placeholder="e.g. Ravi K." />
                  <Input label="ETA" value={fulfil.eta} onChange={(e) => setFulfil({ ...fulfil, eta: e.target.value })} placeholder="e.g. 18 min or 11:40 PM" />
                  <Button variant="secondary" fullWidth onClick={() => update({ rider_name: fulfil.rider_name || null, eta: fulfil.eta || null })}>Save rider and ETA</Button>
                </div>
              )}
              {order.status !== "delivered" && order.status !== "cancelled" && (
                <button
                  onClick={() => window.confirm(`Cancel ${order.code}? The customer will see it as cancelled.`) && update({ status: "cancelled" })}
                  className="text-sm text-danger underline-offset-4 hover:underline"
                >
                  Cancel order
                </button>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Deliver to</h2>
            <p className="mt-2 text-sm leading-relaxed">
              {order.receiver_name}
              <br />
              <a className="text-accent" href={`tel:+91${order.receiver_phone}`}>+91 {order.receiver_phone}</a>
              <br />
              <span className="text-muted">
                {order.address_line1}, {order.area}, Hyderabad {order.pincode}
                {order.landmark ? ` · ${order.landmark}` : ""}
              </span>
              <br />
              <span className="text-muted">Slot: {timeSlots.find((s) => s.id === order.time_slot)?.label}</span>
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Timeline</h2>
            <ol className="mt-2 space-y-2 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>{statusLabel[e.status]}{e.note ? <span className="block text-xs text-muted">{e.note}</span> : null}</span>
                  <time className="whitespace-nowrap text-xs text-muted">{new Date(e.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</time>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <label htmlFor="note" className="text-sm font-semibold">Internal note</label>
            <textarea id="note" rows={3} value={fulfil.admin_note} onChange={(e) => setFulfil({ ...fulfil, admin_note: e.target.value })} className="mt-2 block w-full rounded-xl border border-line bg-surface p-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25" />
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => update({ admin_note: fulfil.admin_note || null })}>Save note</Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={null}>
      <OrderDetail />
    </Suspense>
  );
}
