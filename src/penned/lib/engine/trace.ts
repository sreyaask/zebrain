import type { Bitmap, Point, Stroke } from "./types.ts";

const N8 = [
  [1, 0], [0, 1], [-1, 0], [0, -1], // 4-neighbours first: smoother walks
  [1, 1], [-1, 1], [-1, -1], [1, -1],
] as const;

/** Turn a 1px skeleton into pen strokes (polylines in pixel coordinates). */
export function traceSkeleton(sk: Bitmap, simplifyPx = 0.9): Stroke[] {
  const { width: w, height: h, data } = sk;
  const ink = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] === 1;
  const degree = (x: number, y: number) => N8.reduce((n, [dx, dy]) => n + (ink(x + dx, y + dy) ? 1 : 0), 0);
  const visited = new Uint8Array(w * h);
  const strokes: Stroke[] = [];

  const walk = (sx: number, sy: number): Stroke => {
    const pts: Point[] = [{ x: sx, y: sy }];
    visited[sy * w + sx] = 1;
    let x = sx, y = sy, pdx = 0, pdy = 0;
    for (;;) {
      let best: [number, number] | null = null;
      let bestScore = -Infinity;
      for (const [dx, dy] of N8) {
        const nx = x + dx, ny = y + dy;
        if (!ink(nx, ny) || visited[ny * w + nx]) continue;
        // Prefer continuing in the same direction (keeps strokes through crossings).
        const score = dx * pdx + dy * pdy - (Math.abs(dx) + Math.abs(dy) === 2 ? 0.1 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = [dx, dy];
        }
      }
      if (!best) break;
      [pdx, pdy] = best;
      x += pdx;
      y += pdy;
      visited[y * w + x] = 1;
      pts.push({ x, y });
    }
    // Close small loops (o, a, 0) back to their start.
    const first = pts[0], last = pts[pts.length - 1];
    if (pts.length > 6 && Math.abs(first.x - last.x) <= 1 && Math.abs(first.y - last.y) <= 1) pts.push({ ...first });
    return pts;
  };

  // 1) Open strokes start at endpoints, top-left first (the way people usually start a letter).
  const endpoints: Point[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink(x, y) && degree(x, y) === 1) endpoints.push({ x, y });
  endpoints.sort((a, b) => a.x + a.y * 0.5 - (b.x + b.y * 0.5));
  for (const p of endpoints) if (!visited[p.y * w + p.x]) strokes.push(walk(p.x, p.y));

  // 2) Whatever is left are closed loops or isolated dots.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (ink(x, y) && !visited[y * w + x]) strokes.push(walk(x, y));

  return strokes
    .map((s) => (s.length === 1 ? [s[0], { x: s[0].x + 0.5, y: s[0].y + 0.5 }] : simplify(s, simplifyPx)))
    .filter((s) => s.length >= 2);
}

/** Ramer–Douglas–Peucker polyline simplification. */
export function simplify(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  let idx = 0, max = 0;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = len === 1 && dx === 0 && dy === 0
      ? Math.hypot(pts[i].x - a.x, pts[i].y - a.y)
      : Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / len;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= eps) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}
