import type { Diagram } from "./layout.ts";
import type { GlyphSet, Point, Stroke } from "./types.ts";

/**
 * Turns a simple SVG drawing (the diagrams Gemini redraws: line, polyline, polygon, rect, circle, ellipse, path, text)
 * into pen strokes the plotter can draw. Labels (<text>) are returned separately so they can be written in the
 * customer's own handwriting. Units stay in the SVG's viewBox; layoutHandwriting scales the diagram to the page.
 */
export interface SvgLabel { x: number; y: number; size: number; text: string }
export interface SvgDrawing extends Diagram { labels: SvgLabel[] }

const num = (v: string | undefined, d = 0) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : d;
};

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = m[3] ?? m[4] ?? "";
  return out;
}

function points(list: string): Point[] {
  const n = (list.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const out: Point[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push({ x: n[i], y: n[i + 1] });
  return out;
}

function ellipse(cx: number, cy: number, rx: number, ry: number): Stroke {
  const steps = Math.max(16, Math.round(Math.max(rx, ry) / 3));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/** SVG path data → polylines (M/L/H/V/C/S/Q/T/A/Z, absolute and relative; arcs are approximated by a straight line). */
function pathStrokes(d: string): Stroke[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const strokes: Stroke[] = [];
  let cur: Stroke = [];
  let x = 0, y = 0, sx = 0, sy = 0, cmd = "";
  let lastCtrl: Point | null = null;
  let i = 0;
  const next = () => Number(tokens[i++]);
  const push = (p: Point) => cur.push({ x: p.x, y: p.y });
  const flush = () => {
    if (cur.length > 1) strokes.push(cur);
    cur = [];
  };
  const curve = (pts: Point[]) => {
    const steps = 12;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      let p = pts;
      while (p.length > 1) p = p.slice(1).map((q, k) => ({ x: p[k].x + (q.x - p[k].x) * t, y: p[k].y + (q.y - p[k].y) * t }));
      push(p[0]);
    }
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "Z") {
      push({ x: sx, y: sy });
      x = sx; y = sy;
      flush();
      continue;
    }
    if (i >= tokens.length || /[a-zA-Z]/.test(tokens[i])) { i++; continue; }
    if (C === "M") {
      flush();
      x = ox + next(); y = oy + next(); sx = x; sy = y;
      push({ x, y });
      cmd = rel ? "l" : "L"; // following pairs are line-tos
    } else if (C === "L") {
      x = ox + next(); y = oy + next(); push({ x, y });
    } else if (C === "H") {
      x = (rel ? x : 0) + next(); push({ x, y });
    } else if (C === "V") {
      y = (rel ? y : 0) + next(); push({ x, y });
    } else if (C === "C") {
      const p1 = { x: ox + next(), y: oy + next() }, p2 = { x: ox + next(), y: oy + next() }, p = { x: ox + next(), y: oy + next() };
      curve([{ x, y }, p1, p2, p]); lastCtrl = p2; x = p.x; y = p.y; continue;
    } else if (C === "S") {
      const p1: Point = lastCtrl ? { x: 2 * x - lastCtrl.x, y: 2 * y - lastCtrl.y } : { x, y };
      const p2: Point = { x: ox + next(), y: oy + next() }, p: Point = { x: ox + next(), y: oy + next() };
      curve([{ x, y }, p1, p2, p]); lastCtrl = p2; x = p.x; y = p.y; continue;
    } else if (C === "Q") {
      const p1 = { x: ox + next(), y: oy + next() }, p = { x: ox + next(), y: oy + next() };
      curve([{ x, y }, p1, p]); lastCtrl = p1; x = p.x; y = p.y; continue;
    } else if (C === "T") {
      const p1: Point = lastCtrl ? { x: 2 * x - lastCtrl.x, y: 2 * y - lastCtrl.y } : { x, y };
      const p: Point = { x: ox + next(), y: oy + next() };
      curve([{ x, y }, p1, p]); lastCtrl = p1; x = p.x; y = p.y; continue;
    } else if (C === "A") {
      next(); next(); next(); next(); next();
      x = ox + next(); y = oy + next(); push({ x, y });
    } else {
      i++;
    }
    lastCtrl = null;
  }
  flush();
  return strokes;
}

export function svgToDrawing(svg: string): SvgDrawing {
  const vb = svg.match(/viewBox\s*=\s*"([^"]+)"/i)?.[1].trim().split(/[\s,]+/).map(Number);
  const [vx, vy, width, height] = vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? vb : [0, 0, 1000, 600];
  const strokes: Stroke[] = [];
  const labels: SvgLabel[] = [];
  for (const m of svg.matchAll(/<(line|polyline|polygon|rect|circle|ellipse|path)\b([^>]*)\/?>/gi)) {
    const a = attrs(m[2]);
    switch (m[1].toLowerCase()) {
      case "line":
        strokes.push([{ x: num(a.x1), y: num(a.y1) }, { x: num(a.x2), y: num(a.y2) }]);
        break;
      case "polyline":
        strokes.push(points(a.points ?? ""));
        break;
      case "polygon": {
        const p = points(a.points ?? "");
        if (p.length) strokes.push([...p, p[0]]);
        break;
      }
      case "rect": {
        const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height);
        strokes.push([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }]);
        break;
      }
      case "circle":
        strokes.push(ellipse(num(a.cx), num(a.cy), num(a.r), num(a.r)));
        break;
      case "ellipse":
        strokes.push(ellipse(num(a.cx), num(a.cy), num(a.rx), num(a.ry)));
        break;
      case "path":
        strokes.push(...pathStrokes(a.d ?? ""));
        break;
    }
  }
  for (const m of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)) {
    const a = attrs(m[1]);
    const text = m[2].replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
    if (!text) continue;
    const size = num(a["font-size"], 40);
    const anchor = a["text-anchor"] ?? "start";
    const approxWidth = text.length * size * 0.55;
    const x = num(a.x) - (anchor === "middle" ? approxWidth / 2 : anchor === "end" ? approxWidth : 0);
    labels.push({ x: x - vx, y: num(a.y) - vy, size, text });
  }
  const shifted = strokes
    .filter((s) => s.length > 1)
    .map((s) => s.map((p) => ({ x: p.x - vx, y: p.y - vy })));
  return { strokes: shifted, width, height, labels };
}

/**
 * Writes a diagram's labels in the customer's handwriting, in the diagram's own units (y down, baseline at label.y),
 * and returns the diagram with those strokes added. Characters without a sample are skipped.
 */
export function withHandwrittenLabels(d: SvgDrawing, set: GlyphSet): Diagram {
  const out: Stroke[] = [...d.strokes];
  for (const label of d.labels) {
    const xh = label.size * 0.5; // x-height ≈ half the font size
    let x = label.x;
    for (const ch of Array.from(label.text)) {
      if (ch === " ") { x += xh * 0.75; continue; }
      const g = set.glyphs[ch]?.[0];
      if (!g) { x += xh * 0.6; continue; }
      for (const s of g.strokes) out.push(s.map((p) => ({ x: x + p.x * xh, y: label.y - p.y * xh })));
      x += (g.width + 0.22) * xh;
    }
  }
  return { strokes: out, width: d.width, height: d.height };
}
