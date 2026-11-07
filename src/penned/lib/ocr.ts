"use client";
/**
 * Reads text out of uploaded pages so it can be re-flowed into a notebook.
 * Photos use Tesseract (runs in the browser). PDFs use their text layer, and fall back
 * to OCR page by page when the PDF is a scan.
 */

type Progress = (fraction: number, label: string) => void;

async function ocr(images: Blob[], onProgress?: Progress): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  let current = 0;
  const base = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/tesseract`;
  const worker = await createWorker("eng", 1, {
    // Self-hosted engine and English data (copied by scripts/copy-static-assets.mjs).
    workerPath: `${base}/worker.min.js`,
    corePath: base,
    langPath: base,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.((current + m.progress) / images.length, `Reading page ${current + 1} of ${images.length}`);
    },
  });
  const out: string[] = [];
  try {
    for (; current < images.length; current++) {
      const { data } = await worker.recognize(images[current]);
      out.push(data.text.trim());
    }
  } finally {
    await worker.terminate();
  }
  return out.join("\n\n");
}

async function pdfToText(blob: Blob, onProgress?: Progress): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Served as a static file (copied from pdfjs-dist by scripts/copy-static-assets.mjs) so the bundler leaves it alone.
  pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    let text = "";
    for (const item of content.items) if ("str" in item) text += item.str + (item.hasEOL ? "\n" : "");
    pages.push(text.trim());
    onProgress?.(i / doc.numPages / 2, `Reading PDF page ${i} of ${doc.numPages}`);
  }
  const chars = pages.join("").replace(/\s/g, "").length;
  if (chars >= 40 * doc.numPages) return pages.join("\n\n");

  // Scanned PDF: render pages and OCR them.
  const images: Blob[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    images.push(await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png")));
  }
  return ocr(images, (f, l) => onProgress?.(0.5 + f / 2, l));
}

export async function extractText(files: { blob: Blob; kind: "image" | "pdf" }[], onProgress?: Progress): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const scaled: Progress = (frac, label) => onProgress?.((i + frac) / files.length, label);
    parts.push(f.kind === "pdf" ? await pdfToText(f.blob, scaled) : await ocr([f.blob], scaled));
  }
  return tidy(parts.join("\n\n"));
}

/** Join lines that were broken by the A4 page width; keep real paragraph breaks. */
export function tidy(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/-\n(?=[a-z])/g, "") // hyphenated line breaks
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
