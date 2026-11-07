import type { Bitmap, Box } from "./types.ts";

/** RGBA pixels (e.g. canvas ImageData.data) → 1-bit ink bitmap using Otsu's threshold. */
export function binarize(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Bitmap {
  const n = width * height;
  const gray = new Uint8Array(n);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2], a = rgba[i * 4 + 3];
    // Transparent pixels count as white paper.
    const v = a < 16 ? 255 : Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    gray[i] = v;
    hist[v]++;
  }
  const t = otsu(hist, n);
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = gray[i] < t ? 1 : 0;
  return removeSpecks({ width, height, data }, Math.max(3, Math.round((width * height) / 400000)));
}

function otsu(hist: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  // Ink must be clearly darker than paper; guard against blank pages.
  return Math.min(threshold + 1, 200);
}

export interface Component {
  box: Box;
  pixels: number[]; // indices into the bitmap
}

/** 8-connected components. */
export function components(bm: Bitmap): Component[] {
  const { width: w, height: h, data } = bm;
  const seen = new Uint8Array(w * h);
  const out: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!data[start] || seen[start]) continue;
    const pixels: number[] = [];
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      pixels.push(p);
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w || (dx === 0 && dy === 0)) continue;
          const q = ny * w + nx;
          if (data[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    out.push({ box: { x0, y0, x1, y1 }, pixels });
  }
  return out;
}

function removeSpecks(bm: Bitmap, minPixels: number): Bitmap {
  const data = bm.data.slice();
  for (const c of components(bm)) if (c.pixels.length < minPixels) for (const p of c.pixels) data[p] = 0;
  return { ...bm, data };
}

/** Copy the pixels of the given components into a tight bitmap (with 1px padding). */
export function crop(bm: Bitmap, comps: Component[]): { bitmap: Bitmap; box: Box } {
  const box = merged(comps.map((c) => c.box));
  const width = box.x1 - box.x0 + 3, height = box.y1 - box.y0 + 3;
  const data = new Uint8Array(width * height);
  for (const c of comps)
    for (const p of c.pixels) {
      const x = (p % bm.width) - box.x0 + 1, y = ((p / bm.width) | 0) - box.y0 + 1;
      data[y * width + x] = 1;
    }
  return { bitmap: { width, height, data }, box };
}

export function merged(boxes: Box[]): Box {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

/** Zhang–Suen thinning: reduces strokes to 1px-wide centre lines. Mutates a copy. */
export function thin(bm: Bitmap): Bitmap {
  const { width: w, height: h } = bm;
  const d = bm.data.slice();
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const remove: number[] = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (!d[y * w + x]) continue;
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let i = 0; i < 8; i++) if (seq[i] === 0 && seq[i + 1] === 1) a++;
          if (a !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0 : p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          remove.push(y * w + x);
        }
      if (remove.length) {
        changed = true;
        for (const i of remove) d[i] = 0;
      }
    }
  }
  // Remove staircase pixels: a pixel with two 4-neighbours forming a corner is redundant
  // for 8-connectivity and would otherwise create tiny side branches.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!d[y * w + x]) continue;
      const n = at(x, y - 1), e = at(x + 1, y), s = at(x, y + 1), wv = at(x - 1, y);
      const corner = (n && e && !at(x - 1, y + 1)) || (e && s && !at(x - 1, y - 1)) || (s && wv && !at(x + 1, y - 1)) || (wv && n && !at(x + 1, y + 1));
      if (corner && n + e + s + wv === 2) d[y * w + x] = 0;
    }
  return { width: w, height: h, data: d };
}
