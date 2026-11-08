"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";
import { formatBytes, inspectPdf, optimiseImage } from "@/lib/fileProcessing";
import { Spinner } from "./Spinner";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  kind: "image" | "pdf";
  /** Pages in this file (images = 1; PDFs = real count when it could be read). */
  pages: number;
  previewUrl?: string;
  /** The file to upload (photos are already resized on the device). */
  file?: File;
}

interface UploaderProps {
  label: string;
  hint?: string;
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove?: (id: string) => void;
  /** Enables page reordering (move buttons, and drag on desktop) and Undo after removing. */
  onReorder?: (files: UploadedFile[]) => void;
  /** Accept PDFs as well as images. */
  allowPdf?: boolean;
  multiple?: boolean;
  /** Show a "Use camera" button that opens the rear camera on phones. */
  camera?: boolean;
  maxFiles?: number;
  disabled?: boolean;
}

const MAX_IMAGE_MB = 40; // photos are resized on the device, so large originals are fine
const MAX_PDF_MB = 20;
const ease = "cubic-bezier(.2,.7,.2,1)";

function estimatePdfPages(bytes: number) {
  return Math.min(80, Math.max(1, Math.round(bytes / (90 * 1024))));
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Uploader({ label, hint, files, onAdd, onRemove, onReorder, allowPdf = true, multiple = true, camera = false, maxFiles = 40, disabled }: UploaderProps) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; name: string }[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [removed, setRemoved] = useState<{ file: UploadedFile; index: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  // Always call the latest handlers (processing is async, the parent re-renders meanwhile).
  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;
  const filesRef = useRef(files);
  filesRef.current = files;

  const accept = allowPdf ? "image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf" : "image/jpeg,image/png,image/heic,image/heif,image/webp";

  const handle = useCallback(
    async (incoming: File[]) => {
      if (!incoming.length || disabled) return;
      setError(null);
      setSavedNote(null);
      const room = (multiple ? maxFiles : 1) - (multiple ? filesRef.current.length : 0);
      if (incoming.length > room) {
        if (room <= 0) return setError(`You can add up to ${maxFiles} files per order.`);
        setError(`Only the first ${room} ${room === 1 ? "file was" : "files were"} added. The limit is ${maxFiles} per order.`);
        incoming = incoming.slice(0, room);
      }
      const valid: File[] = [];
      for (const f of incoming) {
        const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        const isImage = f.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name);
        if (!(isImage || (allowPdf && isPdf))) {
          setError(`"${f.name}" isn't supported. Use ${allowPdf ? "JPG, PNG, HEIC or PDF" : "JPG, PNG or HEIC"}.`);
          continue;
        }
        if (f.size > (isPdf ? MAX_PDF_MB : MAX_IMAGE_MB) * 1024 * 1024) {
          setError(`"${f.name}" is larger than ${isPdf ? MAX_PDF_MB : MAX_IMAGE_MB} MB.`);
          continue;
        }
        valid.push(f);
      }
      if (!valid.length) return;

      const batch = valid.map((f) => ({ f, id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}` }));
      setPending((p) => [...p, ...batch.map((b) => ({ id: b.id, name: b.f.name }))]);

      let before = 0;
      let after = 0;
      let images = 0;
      const done: UploadedFile[] = [];
      for (const { f, id } of batch) {
        const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        if (isPdf) {
          const info = await inspectPdf(f);
          done.push({ id, name: f.name, size: f.size, kind: "pdf", pages: info?.pages ?? estimatePdfPages(f.size), previewUrl: info?.previewUrl, file: f });
        } else {
          const img = await optimiseImage(f);
          before += img.before;
          after += img.after;
          images++;
          done.push({ id, name: img.file.name, size: img.file.size, kind: "image", pages: 1, previewUrl: img.previewUrl, file: img.file });
        }
        setPending((p) => p.filter((x) => x.id !== id));
      }
      onAddRef.current(multiple ? done : done.slice(0, 1));
      const pages = done.reduce((s, d) => s + d.pages, 0);
      setAnnounce(`Added ${done.length} ${done.length === 1 ? "file" : "files"}, ${pages} ${pages === 1 ? "page" : "pages"}.`);
      if (images && before - after > 200 * 1024) {
        setSavedNote(`${images === 1 ? "Photo" : `${images} photos`} resized on your phone: ${formatBytes(before)} → ${formatBytes(after)}, so the upload is quicker.`);
      }
    },
    [allowPdf, disabled, maxFiles, multiple],
  );

  // Paste images (desktop: Cmd/Ctrl+V a screenshot) unless typing in a field.
  useEffect(() => {
    if (disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const pasted = Array.from(e.clipboardData?.files ?? []);
      if (pasted.length) {
        e.preventDefault();
        handle(pasted);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handle, disabled]);

  // Undo window after removing a page.
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(t);
  }, [removed]);

  // Animate tiles to their new positions when pages are reordered (FLIP).
  const gridRef = useRef<HTMLOListElement>(null);
  const tileRefs = useRef(new Map<string, HTMLLIElement>());
  const prevPos = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const next = new Map<string, { x: number; y: number }>();
    const animate = !reduceMotion();
    tileRefs.current.forEach((el, id) => {
      const pos = { x: el.offsetLeft, y: el.offsetTop };
      next.set(id, pos);
      const prev = prevPos.current.get(id);
      if (animate && prev && (prev.x !== pos.x || prev.y !== pos.y)) {
        el.animate([{ transform: `translate(${prev.x - pos.x}px, ${prev.y - pos.y}px)` }, { transform: "none" }], { duration: 240, easing: ease });
      }
    });
    prevPos.current = next;
  }, [files]);

  const move = (from: number, to: number) => {
    if (!onReorder || to < 0 || to >= files.length || from === to) return;
    const next = [...files];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorder(next);
    setAnnounce(`${item.name} moved to position ${to + 1} of ${files.length}.`);
  };

  const remove = (index: number) => {
    const f = files[index];
    onRemove?.(f.id);
    if (onReorder) setRemoved({ file: f, index });
    setAnnounce(`Removed ${f.name}.`);
  };

  const undo = () => {
    if (!removed || !onReorder) return;
    const next = [...filesRef.current];
    next.splice(Math.min(removed.index, next.length), 0, removed.file);
    onReorder(next);
    setRemoved(null);
    setAnnounce(`Restored ${removed.file.name}.`);
  };

  const onZoneDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled && e.dataTransfer.types.includes("Files")) handle(Array.from(e.dataTransfer.files));
  };

  // Page numbers each file will cover, e.g. "3–14" for a 12-page PDF after two photos.
  let cursor = 0;
  const ranges = files.map((f) => {
    const start = cursor + 1;
    cursor += f.pages;
    return f.pages > 1 ? `${start}–${cursor}` : `${start}`;
  });
  const showGrid = multiple && (files.length > 0 || pending.length > 0);

  return (
    <div>
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={onZoneDrop}
        className={cn(
          "relative rounded-xl border border-dashed bg-surface px-6 text-center transition-colors duration-200",
          showGrid ? "py-6" : "py-10",
          dragging ? "border-accent bg-accent-soft" : "border-ink/20",
          disabled && "opacity-60",
        )}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-accent-soft/90 text-[15px] font-medium text-accent animate-fade-in">
            Drop to add {multiple ? "your pages" : "your photo"}
          </div>
        )}
        {!showGrid && (
          <svg className="mx-auto h-8 w-8 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <p className={cn("text-[15px] font-medium text-ink", !showGrid && "mt-3")}>{showGrid ? "Add more pages" : label}</p>
        {hint && !showGrid && <p className="mt-1 text-sm text-muted">{hint}</p>}
        <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
          {camera && (
            <label
              className={cn(
                "inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white hover:bg-[#182f72] sm:w-auto",
                "focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2",
                disabled && "pointer-events-none",
              )}
            >
              Take a photo
              <input
                type="file"
                className="sr-only"
                accept="image/*"
                capture="environment"
                disabled={disabled}
                onChange={(e) => {
                  handle(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <label
            htmlFor={inputId}
            className={cn(
              "inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-line bg-paper px-4 text-sm font-medium text-ink hover:border-ink/30 sm:w-auto",
              "focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2",
              disabled && "pointer-events-none",
            )}
          >
            {multiple ? "Choose files" : "Choose a photo"}
            <input
              id={inputId}
              type="file"
              className="sr-only"
              accept={accept}
              multiple={multiple}
              disabled={disabled}
              onChange={(e) => {
                handle(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          <span className="hidden text-sm text-muted md:inline">or drag and drop, or paste</span>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {/* Single photo (handwriting setup): one large preview */}
      {!multiple && (files[0] || pending[0]) && (
        <div className="mt-4 flex animate-tile-in items-center gap-4 rounded-xl border border-line bg-surface p-3">
          <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-paper">
            {files[0]?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={files[0].previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Spinner className="h-5 w-5 text-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{files[0]?.name ?? pending[0]?.name}</p>
            <p className="text-xs text-muted">{files[0] ? formatBytes(files[0].size) : "Preparing photo"}</p>
          </div>
          {files[0] && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(files[0].id)}
              className="h-10 rounded-lg px-3 text-sm text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* Several pages: a numbered grid you can reorder */}
      {showGrid && (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <p className="font-medium text-ink">
              {files.length} {files.length === 1 ? "file" : "files"} · {cursor} {cursor === 1 ? "page" : "pages"}
            </p>
            {onReorder && files.length > 1 && <p className="text-xs text-muted">Pages are written in this order</p>}
          </div>
          <ol ref={gridRef} className="relative grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5" aria-label="Uploaded pages, in writing order">
            {files.map((f, i) => (
              <li
                key={f.id}
                ref={(el) => {
                  if (el) tileRefs.current.set(f.id, el);
                  else tileRefs.current.delete(f.id);
                }}
                draggable={!!onReorder}
                onDragStart={(e) => {
                  setDragId(f.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", f.id);
                }}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => {
                  if (dragId && dragId !== f.id) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.stopPropagation();
                  move(files.findIndex((x) => x.id === dragId), i);
                  setDragId(null);
                }}
                className={cn("animate-tile-in min-w-0", dragId === f.id && "opacity-40")}
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-line bg-white">
                  {f.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.previewUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-semibold uppercase text-muted">{f.kind}</div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-ink/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
                    p. {ranges[i]}
                  </span>
                  {f.kind === "pdf" && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-ink">PDF · {f.pages}p</span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-muted" title={f.name}>
                  {f.name}
                </p>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  {onReorder ? (
                    <>
                      <TileButton label={`Move ${f.name} earlier`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                        <path d="M10 4L6 8l4 4" />
                      </TileButton>
                      <TileButton label={`Move ${f.name} later`} disabled={i === files.length - 1} onClick={() => move(i, i + 1)}>
                        <path d="M6 4l4 4-4 4" />
                      </TileButton>
                    </>
                  ) : (
                    <span className="col-span-2" />
                  )}
                  {onRemove && (
                    <TileButton label={`Remove ${f.name}`} onClick={() => remove(i)} danger>
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </TileButton>
                  )}
                </div>
              </li>
            ))}
            {pending.map((p) => (
              <li key={p.id} className="min-w-0 animate-tile-in" aria-label={`Preparing ${p.name}`}>
                <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-paper text-muted">
                  <Spinner className="h-5 w-5" />
                  <span className="text-[11px]">Preparing</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted">{p.name}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {savedNote && <p className="mt-3 animate-fade-in text-xs text-success">{savedNote}</p>}

      {removed && (
        <div className="mt-3 flex animate-fade-in items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm" role="status">
          <span className="truncate text-muted">Removed {removed.file.name}</span>
          <button
            type="button"
            onClick={undo}
            className="shrink-0 rounded font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function TileButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors",
        "hover:border-ink/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-35",
        danger && "hover:border-danger/40 hover:text-danger",
      )}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
