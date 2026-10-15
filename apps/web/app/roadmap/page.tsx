import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

export const runtime = 'edge';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('roadmap');
  return { title: t('title'), description: t('meta_description') };
}

type Status = 'done' | 'next' | 'planned';
type Phase = {
  status: Status;
  name: string;
  goal: string;
  items: { done: boolean; text: string }[];
  exit: string;
};

const BADGE = { done: 'success', next: 'accent', planned: 'default' } as const;

export default async function RoadmapPage() {
  const t = await getTranslations('roadmap');
  const phases = t.raw('phases') as Phase[];

  return (
    <>
      <SiteHeader />
      <main>
        <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-5 text-lg leading-relaxed text-text-muted">{t('intro')}</p>
          <p className="mt-3 text-sm text-text-muted">{t('updated')}</p>

          <ol className="mt-12 space-y-6">
            {phases.map((p, i) => (
              <li
                key={p.name}
                className={cn(
                  'rounded-lg border bg-bg-card p-5 sm:p-6',
                  p.status === 'next' ? 'border-accent/50' : 'border-border'
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold tracking-tight">
                    <span className="num-display text-text-muted">{i + 1}.</span> {p.name}
                  </h2>
                  <Badge variant={BADGE[p.status]}>{t(`status.${p.status}`)}</Badge>
                </div>
                <p className="mt-2 text-text-muted">
                  <span className="text-text-primary">{t('goal')}:</span> {p.goal}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.items.map((it) => (
                    <li key={it.text} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          it.done ? 'border-success/60 bg-success-soft text-success' : 'border-border'
                        )}
                      >
                        {it.done && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className={it.done ? 'text-text-primary' : 'text-text-muted'}>{it.text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-border pt-4 text-sm text-text-muted">
                  <span className="text-text-primary">{t('exit')}:</span> {p.exit}
                </p>
              </li>
            ))}
          </ol>

          <section className="mt-12" aria-labelledby="later-title">
            <h2 id="later-title" className="text-xl font-semibold tracking-tight">
              {t('later_title')}
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-text-muted marker:text-text-dim">
              {(t.raw('later') as string[]).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>

          <p className="mt-12">
            <Link href="/whitepaper" className="text-accent underline underline-offset-2">
              {t('whitepaper_link')}
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
