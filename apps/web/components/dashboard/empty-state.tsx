import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function EmptyState({
  title,
  body,
  icon,
  cta
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        {icon ? (
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-accent/10 text-accent">
            {icon}
          </div>
        ) : null}
        <div className="text-base font-medium text-text-primary">{title}</div>
        {body ? <p className="max-w-md text-sm text-text-muted">{body}</p> : null}
        {cta ? <div className="mt-2">{cta}</div> : null}
      </CardContent>
    </Card>
  );
}
