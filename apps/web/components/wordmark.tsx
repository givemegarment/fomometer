import { cn } from '@/lib/cn';

/** Brand mark: a three-step meter, the last step in brand green, plus the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] text-text-primary', className)}>
      <svg aria-hidden viewBox="0 0 14 12" className="h-3.5 w-4">
        <rect x="0" y="7" width="3" height="5" rx="0.5" fill="#3A3A3F" />
        <rect x="5.5" y="4" width="3" height="8" rx="0.5" fill="#8A8E95" />
        <rect x="11" y="0" width="3" height="12" rx="0.5" fill="#00B24B" />
      </svg>
      FOMOMETER
    </span>
  );
}
