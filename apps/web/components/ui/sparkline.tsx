'use client';

import { useId, useMemo } from 'react';
import { cn } from '@/lib/cn';

export function Sparkline({
  data,
  className,
  width = 80,
  height = 24,
  positiveColor = '#1FC16B',
  negativeColor = '#FF4D4F',
  flatColor = '#8A8D94'
}: {
  data: ReadonlyArray<number>;
  className?: string;
  width?: number;
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
  flatColor?: string;
}) {
  const gradientId = `spark-${useId().replace(/:/g, '')}`;
  const { path, fill, color } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: '', fill: '', color: flatColor };
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
    const fillPath = `${d} L${width},${height} L0,${height} Z`;
    const first = data[0] ?? 0;
    const last = data[data.length - 1] ?? 0;
    const c = last > first ? positiveColor : last < first ? negativeColor : flatColor;
    return { path: d, fill: fillPath, color: c };
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
          stroke="#34373F"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  return (
    <svg className={cn(className)} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
