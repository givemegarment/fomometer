'use client';

import { useEffect, useRef, useState } from 'react';

/** Counts from 0 to `value` once it is visible (0.9s ease-out). Reduced motion: shows the value. */
export function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString('en-US') }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setShown(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 900);
        setShown(value * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref} className="num-display">
      {format(shown)}
    </span>
  );
}
