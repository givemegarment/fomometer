import { cn } from '@/lib/cn';

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[15px] font-bold tracking-[0.08em] text-text-primary', className)}>
      <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
      FOMOMETER
    </span>
  );
}
