import type { Bitmap } from "./types.ts";
import type { Diagram } from "./layout.ts";
import { thin } from "./raster.ts";
import { traceSkeleton } from "./trace.ts";

/**
 * Traces a diagram (a cropped scan, already binarised) into pen strokes so the
 * pen machine can draw it as line art. Same thinning + tracing as the letters.
 */
export function traceDiagram(bm: Bitmap): Diagram {
  const strokes = traceSkeleton(thin(bm), 1.2).filter((s) => {
    // Drop specks: strokes shorter than ~1.5 % of the diagram's size.
    let len = 0;
    for (let i = 1; i < s.length; i++) len += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
    return len >= Math.max(4, 0.015 * Math.max(bm.width, bm.height));
  });
  return { strokes, width: bm.width, height: bm.height };
}
