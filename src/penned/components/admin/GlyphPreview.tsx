import type { Glyph } from "@/lib/engine/types.ts";

/** Draws one glyph sample in a box with its baseline, for review. */
export function GlyphPreview({ glyph, size = 56, ink = "#22409A" }: { glyph: Glyph; size?: number; ink?: string }) {
  // Frame: 2.4 x-heights tall (ascender to descender), baseline at 0.
  const top = 1.8, bottom = -0.6, h = top - bottom;
  const w = Math.max(glyph.width + 0.3, 0.9);
  return (
    <svg width={(size * w) / h} height={size} viewBox={`${-0.15} ${-top} ${w} ${h}`} aria-hidden="true">
      <line x1={-0.15} x2={w} y1={0} y2={0} stroke="#E6E3DC" strokeWidth={0.02} />
      <g fill="none" stroke={ink} strokeWidth={0.07} strokeLinecap="round" strokeLinejoin="round">
        {glyph.strokes.map((s, i) => (
          <polyline key={i} points={s.map((p) => `${p.x},${-p.y}`).join(" ")} />
        ))}
      </g>
    </svg>
  );
}
