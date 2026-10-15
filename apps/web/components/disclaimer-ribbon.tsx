import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

/** Static, in-flow disclaimer line. Not sticky, so it never covers navigation. */
export function DisclaimerRibbon() {
  const t = useTranslations('common');
  return (
    <p className="flex items-start justify-center gap-2 border-t border-border px-4 py-3 text-center text-xs text-text-muted">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      <span>{t('disclaimer')}</span>
    </p>
  );
}
