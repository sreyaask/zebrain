"use client";

import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  kind: "image" | "pdf";
  /** Estimated pages in this file (images = 1). */
  pages: number;
  previewUrl?: string;
  /** The original file, kept so it can be uploaded when the order is placed. */
  file?: File;
}

interface UploaderProps {
  label: string;
  hint?: string;
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove?: (id: string) => void;
  /** Accept PDFs as well as images. */
  allowPdf?: boolean;
  multiple?: boolean;
  /** Show a "Use camera" button that opens the rear camera on phones. */
  camera?: boolean;
  maxFiles?: number;
  maxSizeMb?: number;
  disabled?: boolean;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Mock page detection for PDFs: roughly one page per 90 KB. */
function estimatePdfPages(bytes: number) {
  return Math.min(80, Math.max(1, Math.round(bytes / (90 * 1024))));
}

export function Uploader({
  label,
  hint,
  files,
  onAdd,
  onRemove,
  allowPdf = true,
  multiple = true,
  camera = false,
  maxFiles = 40,
  maxSizeMb = 20,
  disabled,
}: UploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = allowPdf ? "image/jpeg,image/png,image/heic,image/webp,application/pdf" : "image/jpeg,image/png,image/heic,image/webp";

  const handle = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      setError(null);
      const incoming = Array.from(list);
      if (files.length + incoming.length > maxFiles) {
        setError(`You can upload up to ${maxFiles} files per order.`);
        return;
      }
      const accepted: UploadedFile[] = [];
      for (const f of incoming) {
        const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
        const isImage = f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(f.name);
        if (!(isImage || (allowPdf && isPdf))) {
          setError(`"${f.name}" isn't supported. Use ${allowPdf ? "JPG, PNG, HEIC or PDF" : "JPG, PNG or HEIC"}.`);
          continue;
        }
        if (f.size > maxSizeMb * 1024 * 1024) {
          setError(`"${f.name}" is larger than ${maxSizeMb} MB.`);
          continue;
        }
        accepted.push({
          id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          size: f.size,
          kind: isPdf ? "pdf" : "image",
          pages: isPdf ? estimatePdfPages(f.size) : 1,
          previewUrl: isImage && typeof URL !== "undefined" ? URL.createObjectURL(f) : undefined,
          file: f,
        });
      }
      if (accepted.length) onAdd(multiple ? accepted : accepted.slice(0, 1));
    },
    [files.length, maxFiles, allowPdf, maxSizeMb, onAdd, multiple],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handle(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border border-dashed bg-surface px-6 py-10 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-ink/20",
          disabled && "opacity-60",
        )}
      >
        <svg className="mx-auto h-8 w-8 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="mt-3 text-[15px] font-medium text-ink">{label}</p>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
        <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <label
            htmlFor={inputId}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center rounded-xl border border-line bg-paper px-4 text-sm font-medium text-ink hover:border-ink/30",
              "focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2",
              disabled && "pointer-events-none",
            )}
          >
            Choose files
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              className="sr-only"
              accept={accept}
              multiple={multiple}
              disabled={disabled}
              onChange={(e) => {
                handle(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {camera && (
            <label
              className={cn(
                "inline-flex h-10 cursor-pointer items-center rounded-xl px-4 text-sm font-medium text-accent hover:bg-accent-soft",
                "focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2",
                disabled && "pointer-events-none",
              )}
            >
              Use camera
              <input
                ref={cameraRef}
                type="file"
                className="sr-only"
                accept="image/*"
                capture="environment"
                disabled={disabled}
                onChange={(e) => {
                  handle(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <span className="hidden text-sm text-muted sm:inline">or drag and drop here</span>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface" aria-label="Uploaded files">
          {files.map((f) => (
            <li key={f.id} className="flex animate-fade-in items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper text-[10px] font-semibold uppercase text-muted">
                {f.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  f.kind
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{f.name}</p>
                <p className="text-xs text-muted">
                  {formatSize(f.size)} · {f.pages} {f.pages === 1 ? "page" : "pages"}
                </p>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(f.id)}
                  className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`Remove ${f.name}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
