'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common');
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <AlertTriangle className="h-6 w-6 text-danger" aria-hidden />
        <div className="text-base font-medium text-text-primary">{t('error')}</div>
        <p className="max-w-md text-sm text-text-muted">{t('error_body')}</p>
        <Button onClick={reset} variant="primary">
          {t('retry')}
        </Button>
      </CardContent>
    </Card>
  );
}
