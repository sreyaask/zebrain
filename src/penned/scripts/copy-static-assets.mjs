// Copies browser-side engines into public/ so they're served from our own site:
// - the PDF.js worker (bundling it breaks minification)
// - Tesseract's worker, LSTM engine and English data (so OCR doesn't depend on a public CDN)
import { copyFileSync, mkdirSync } from "node:fs";

const copy = (from, to) => copyFileSync(`node_modules/${from}`, `public/${to}`);
mkdirSync("public/tesseract", { recursive: true });
copy("pdfjs-dist/build/pdf.worker.min.mjs", "pdf.worker.min.mjs");
copy("tesseract.js/dist/worker.min.js", "tesseract/worker.min.js");
copy("tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract/tesseract-core-lstm.wasm.js");
copy("tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract/tesseract-core-simd-lstm.wasm.js");
copy("@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "tesseract/eng.traineddata.gz");
