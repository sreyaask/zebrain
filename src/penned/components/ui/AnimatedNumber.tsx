"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts smoothly from the previous value to the new one (300 ms, ease-out), so a price change reads
 * as a change rather than a flicker. Jumps straight to the value when reduced motion is on.
 */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 300);
      const eased = 1 - Math.pow(1 - p, 3);
      const n = Math.round(start + (value - start) * eased);
      setShown(n);
      from.current = n;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className="tabular-nums">{format(shown)}</span>;
}
