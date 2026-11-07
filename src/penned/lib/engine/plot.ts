import type { PlotPage, Stroke } from "./types.ts";

export interface PlotterSettings {
  /** Command that lifts the pen. "G0 Z5" for Z-axis plotters, "M3 S30" for many GRBL servo builds. */
  penUp: string;
  penDown: string;
  drawFeed: number; // mm/min
  travelFeed: number; // mm/min
  /** Plotter origin is bottom-left (most GRBL machines): flip Y so the page isn't mirrored. */
  flipY: boolean;
  offsetXMm: number;
  offsetYMm: number;
  /** Milliseconds to wait after pen up/down so the servo settles. */
  penDelayMs: number;
}

export const plotterPresets: Record<"z-axis" | "grbl-servo" | "axidraw-svg", { label: string; settings: PlotterSettings }> = {
  "z-axis": {
    label: "Z-axis pen lift (G0 Z)",
    settings: { penUp: "G0 Z5", penDown: "G1 Z0 F1500", drawFeed: 2500, travelFeed: 6000, flipY: true, offsetXMm: 0, offsetYMm: 0, penDelayMs: 0 },
  },
  "grbl-servo": {
    label: "GRBL servo (M3 S)",
    settings: { penUp: "M3 S30", penDown: "M3 S90", drawFeed: 2500, travelFeed: 6000, flipY: true, offsetXMm: 0, offsetYMm: 0, penDelayMs: 150 },
  },
  "axidraw-svg": {
    label: "AxiDraw / Inkscape (use the SVG)",
    settings: { penUp: "G0 Z5", penDown: "G1 Z0 F1500", drawFeed: 2500, travelFeed: 6000, flipY: false, offsetXMm: 0, offsetYMm: 0, penDelayMs: 0 },
  },
};

const INK = { blue: "#22409A", black: "#1A1A1A" } as const;

/** One SVG per page, sized in real millimetres so it plots 1:1. */
export function pageToSvg(page: PlotPage, ink: "blue" | "black" = "blue", opts: { ruled?: boolean; pitchMm?: number; topMm?: number } = {}): string {
  const paths = page.strokes.filter((s) => s.length > 1).map((s) => `<path d="${pathData(s)}"/>`).join("");
  // Ruling is drawn on a separate, non-plotting layer for preview only.
  let rules = "";
  if (opts.ruled && opts.pitchMm && opts.topMm !== undefined) {
    const ys: number[] = [];
    for (let y = opts.topMm; y < page.heightMm - 5; y += opts.pitchMm) ys.push(y);
    rules = `<g id="preview-ruling" stroke="#CBD5E8" stroke-width="0.2">${ys.map((y) => `<line x1="0" x2="${page.widthMm}" y1="${y.toFixed(2)}" y2="${y.toFixed(2)}"/>`).join("")}</g>`;
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${page.widthMm}mm" height="${page.heightMm}mm" viewBox="0 0 ${page.widthMm} ${page.heightMm}">` +
    rules +
    `<g id="pen" fill="none" stroke="${INK[ink]}" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`
  );
}

function pathData(s: Stroke): string {
  return s.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("");
}

/** G-code for all pages; the machine pauses (M0) between pages so the operator can turn the page. */
export function pagesToGcode(pages: PlotPage[], s: PlotterSettings, meta: { orderCode: string }): string {
  const out: string[] = [
    `; Penned ${meta.orderCode} — ${pages.length} page(s)`,
    `; generated ${new Date().toISOString()}`,
    "G21 ; millimetres",
    "G90 ; absolute",
    s.penUp,
  ];
  const dwell = s.penDelayMs > 0 ? [`G4 P${(s.penDelayMs / 1000).toFixed(3)}`] : [];
  const tx = (p: { x: number; y: number }, page: PlotPage) => {
    const x = p.x + s.offsetXMm;
    const y = (s.flipY ? page.heightMm - p.y : p.y) + s.offsetYMm;
    return `X${x.toFixed(2)} Y${y.toFixed(2)}`;
  };
  pages.forEach((page, i) => {
    out.push(`; ---- page ${i + 1} of ${pages.length} ----`);
    for (const stroke of page.strokes) {
      if (stroke.length < 2) continue;
      out.push(`G0 ${tx(stroke[0], page)} F${s.travelFeed}`, s.penDown, ...dwell);
      for (let k = 1; k < stroke.length; k++) out.push(`G1 ${tx(stroke[k], page)} F${s.drawFeed}`);
      out.push(s.penUp, ...dwell);
    }
    if (i < pages.length - 1) out.push("G0 X0 Y0", `M0 ; load page ${i + 2}, then resume`);
  });
  out.push("G0 X0 Y0", "M2 ; done");
  return out.join("\n") + "\n";
}

/** Rough plotting time, for the job card. */
export function estimateMinutes(pages: PlotPage[], s: PlotterSettings): number {
  let draw = 0, travel = 0, lifts = 0;
  let last = { x: 0, y: 0 };
  for (const page of pages)
    for (const st of page.strokes) {
      travel += Math.hypot(st[0].x - last.x, st[0].y - last.y);
      for (let i = 1; i < st.length; i++) draw += Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y);
      last = st[st.length - 1];
      lifts++;
    }
  return draw / s.drawFeed + travel / s.travelFeed + (lifts * Math.max(0.15, s.penDelayMs / 1000 * 2)) / 60;
}
