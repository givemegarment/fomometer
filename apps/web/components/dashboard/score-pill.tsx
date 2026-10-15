import { cn } from '@/lib/cn';

/** Score 0 to 100 as a compact chip; brand green from 70, the engine's default BUY level. */
export function ScorePill({ score, className }: { score: number | null; className?: string }) {
  const v = score ?? 0;
  const display = score == null ? '·' : (v * 100).toFixed(0);
  return (
    <span
      className={cn(
        'num-display inline-flex min-w-[2.25rem] items-center justify-center rounded-sm px-1.5 py-0.5 text-xs font-semibold',
        score != null && v >= 0.7 ? 'bg-accent-deep text-accent' : 'bg-white/[0.06] text-text-primary',
        className
      )}
    >
      {display}
    </span>
  );
}
