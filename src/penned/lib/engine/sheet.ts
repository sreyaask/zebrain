/**
 * The handwriting sample sheet. Customers write each line on its own line,
 * with letters separate (not joined), and repeat the whole block 3 times.
 */
export const SHEET_LINES = [
  "The quick brown fox jumps over the lazy dog.",
  "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG",
  "0123456789 , . ? ! ( ) + − = %",
] as const;

export const SHEET_REPEATS = 3;

/** Characters expected on a sheet line, in writing order (spaces removed). */
export function expectedChars(line: string): string[] {
  return Array.from(line).filter((c) => c.trim() !== "");
}

/** Every character a complete sheet teaches the engine. */
export const SHEET_CHARSET = new Set(SHEET_LINES.flatMap((l) => expectedChars(l)));

/** Lowercase letters that sit between baseline and x-height (no ascender/descender). */
export const X_HEIGHT_CHARS = new Set(Array.from("acemnorsuvwxz"));
export const DESCENDERS = new Set(Array.from("gjpqyQJ,"));
