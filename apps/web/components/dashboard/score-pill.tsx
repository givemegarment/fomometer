import { cn } from '@/lib/cn';

export function ScorePill({ score, className }: { score: number | null; className?: string }) {
  const v = score ?? 0;
  const display = score == null ? '·' : (v * 100).toFixed(0);
  const tone =
    v >= 0.7 ? 'border-accent/40 bg-accent/10 text-accent'
    : v >= 0.5 ? 'border-warning/40 bg-warning-soft text-warning'
    : 'border-border bg-bg-chip text-text-muted';
  return (
    <span
      className={cn(
        'num-display inline-flex min-w-[2.5rem] items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold',
        tone,
        className
      )}
    >
      {display}
    </span>
  );
}
