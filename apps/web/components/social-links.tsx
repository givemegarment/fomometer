import { cn } from '@/lib/cn';
import { TOKEN_LAUNCHED, TOKEN_SYMBOL, TOKEN_URL, X_URL } from '@/lib/token';

/** The X logo (the brand's own mark), as an icon link to the project's account. */
export function XLink({ label, className }: { label: string; className?: string }) {
  return (
    <a
      href={X_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-primary',
        className
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </a>
  );
}

/** "$FMTR" pill to the token's pump.fun page; renders nothing before launch. */
export function TokenLink({ label, className }: { label: string; className?: string }) {
  if (!TOKEN_LAUNCHED) return null;
  return (
    <a
      href={TOKEN_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className={cn(
        'ring-hair inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1 text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.06]',
        className
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />${TOKEN_SYMBOL}
      <span className="sr-only"> {label}</span>
    </a>
  );
}
