import { cn } from '@/lib/cn';
import { REPO_URL, TOKEN_LAUNCHED, TOKEN_SYMBOL, TOKEN_URL, X_URL } from '@/lib/token';

const ICON_LINK =
  'inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-primary';

/** The X logo (the brand's own mark), as an icon link to the project's account. */
export function XLink({ label, className }: { label: string; className?: string }) {
  return (
    <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={cn(ICON_LINK, className)}>
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </a>
  );
}

/** The GitHub mark, as an icon link to the open-source repository. */
export function GitHubLink({ label, className }: { label: string; className?: string }) {
  return (
    <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={cn(ICON_LINK, className)}>
      <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px] fill-current">
        <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
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
