/** Shared types for the handwriting engine. All engine code is dependency-free TypeScript. */

/** 1-bit image: data[y * width + x] === 1 means ink. */
export interface Bitmap {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Point {
  x: number;
  y: number;
}

/** A continuous pen-down path. */
export type Stroke = Point[];

export interface Box {
  x0: number;
  y0: number;
  x1: number; // inclusive
  y1: number; // inclusive
}

/**
 * One handwritten sample of one character.
 * Units are x-heights; origin is the left edge on the baseline; y points UP.
 */
export interface Glyph {
  char: string;
  strokes: Stroke[];
  width: number;
  top: number; // highest point above baseline
  bottom: number; // lowest point (negative = descender)
}

export interface GlyphSet {
  version: 1;
  /** Samples per character. Several samples give natural variation. */
  glyphs: Record<string, Glyph[]>;
  /** Pixel x-height measured on the scan, kept for reference. */
  xHeightPx: number;
  createdAt: string;
}

/** A drawable page: strokes in millimetres, origin top-left, y down. */
export interface PlotPage {
  widthMm: number;
  heightMm: number;
  strokes: Stroke[];
}
