import { useEffect, useRef, useState } from "react";

/**
 * Animate a number from 0 → target on first mount using requestAnimationFrame.
 * Subsequent target changes snap immediately (avoids re-animating on data refresh).
 *
 * Returns the current displayed value. Caller formats for display.
 *
 * Pass `instant={true}` to skip the animation entirely (useful for tests or
 * when the user prefers reduced motion).
 */
export function useCountUp(target: number, durationMs: number = 1200, instant: boolean = false): number {
  const [val, setVal] = useState<number>(instant ? target : 0);
  const firstMount = useRef(true);

  useEffect(() => {
    if (!firstMount.current) {
      setVal(target);
      return;
    }
    firstMount.current = false;
    if (instant || durationMs <= 0) {
      setVal(target);
      return;
    }
    if (typeof requestAnimationFrame === "undefined") {
      setVal(target);
      return;
    }
    const start = performance.now();
    let raf: number;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out quart — slower start, dramatic settle
      const eased = 1 - Math.pow(1 - t, 4);
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      if (raf !== undefined) cancelAnimationFrame(raf);
    };
  }, [target, durationMs, instant]);

  return val;
}
