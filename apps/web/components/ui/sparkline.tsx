'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/cn';

export function Sparkline({
  data,
  className,
  width = 80,
  height = 24,
  positiveColor = '#22C55E',
  negativeColor = '#F2555A',
  flatColor = '#80848C'
}: {
  data: ReadonlyArray<number>;
  className?: string;
  width?: number;
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
  flatColor?: string;
}) {
  const { path, color } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: '', color: flatColor };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const v of data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;
    const dx = width / (data.length - 1);
    let d = '';
    for (let i = 0; i < data.length; i++) {
      const x = i * dx;
      const v = data[i] ?? 0;
      const y = height - ((v - min) / range) * height;
      d += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : ` L${x.toFixed(2)},${y.toFixed(2)}`;
    }
    const first = data[0] ?? 0;
    const last = data[data.length - 1] ?? 0;
    const c = last > first ? positiveColor : last < first ? negativeColor : flatColor;
    return { path: d, color: c };
  }, [data, width, height, positiveColor, negativeColor, flatColor]);

  // Not enough points: a quiet dashed baseline, not a loading shimmer.
  if (!path) {
    return (
      <svg className={className} width={width} height={height} aria-hidden="true">
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#2C3037"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  return (
    <svg className={cn(className)} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
