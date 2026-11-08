"use client";
/**
 * Prepares uploads on the device before they're sent:
 * - photos are scaled to at most 2400 px on the long edge and re-encoded as JPEG (phone photos
 *   go from ~4 MB to well under 1 MB, which matters on mobile data), keeping their rotation;
 * - PDFs get their real page count and a thumbnail of page 1.
 * Everything fails safe: if a step isn't supported (for example HEIC outside Safari), the original is kept.
 */

export interface ProcessedImage {
  file: File;
  before: number;
  after: number;
  previewUrl: string;
}

export async function optimiseImage(original: File, maxEdge = 2400, quality = 0.85): Promise<ProcessedImage> {
  const keep = (): ProcessedImage => ({ file: original, before: original.size, after: original.size, previewUrl: URL.createObjectURL(original) });
  if (typeof createImageBitmap !== "function") return keep();
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(original, { imageOrientation: "from-image" });
  } catch {
    return keep(); // e.g. HEIC in Chrome: upload as-is
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && original.size < 700 * 1024) {
    bitmap.close();
    return keep();
  }
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return keep();
  }
  ctx.fillStyle = "#fff"; // transparent PNGs become white paper, not black
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob || blob.size >= original.size) return keep();
  const file = new File([blob], original.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
  return { file, before: original.size, after: file.size, previewUrl: URL.createObjectURL(file) };
}

export interface ProcessedPdf {
  pages: number;
  previewUrl?: string;
}

/** Reads the real page count and renders a small thumbnail of page 1. Loads PDF.js only when a PDF is added. */
export async function inspectPdf(file: File): Promise<ProcessedPdf | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pdf.worker.min.mjs`;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let previewUrl: string | undefined;
    try {
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 240 / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
      previewUrl = canvas.toDataURL("image/jpeg", 0.8);
    } catch {
      /* page count is still useful without a thumbnail */
    }
    const pages = doc.numPages;
    await doc.destroy();
    return { pages, previewUrl };
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
