import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { DocLayout } from '@/components/docs/doc-layout';
import { DocSection } from '@/components/doc-section';
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
/** Color strip on top of each phase card, by status. */
const STRIP = {
  done: 'bg-accent',
  next: 'bg-[linear-gradient(90deg,#4E4EA3,#7C7CC7)]',
  planned: 'bg-white/10'
} as const;

export default async function RoadmapPage() {
  const t = await getTranslations('roadmap');
  const phases = t.raw('phases') as Phase[];

  return (
    <DocLayout
      kicker={t('updated')}
      title={t('title')}
      lede={t('intro')}
      tocLabel={t('toc')}
      toc={[...phases.map((p, i) => ({ id: `phase-${i + 1}`, title: p.name })), { id: 'later', title: t('later_title') }]}
    >
      {phases.map((p, i) => {
        const done = p.items.filter((it) => it.done).length;
        return (
          <section key={p.name} id={`phase-${i + 1}`} aria-labelledby={`phase-${i + 1}-title`} className="scroll-mt-24">
            <div className={cn('ring-hair overflow-hidden rounded-2xl bg-bg-card', p.status === 'next' && 'ring-1 ring-inset ring-accent/40')}>
              <div className={cn('h-1.5', STRIP[p.status])} />
              <div className="p-6 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id={`phase-${i + 1}-title`} className="text-display-md">
                    <span className="num-display mr-2 text-text-dim">{String(i + 1).padStart(2, '0')}</span>
                    {p.name}
                  </h2>
                  <Badge variant={BADGE[p.status]}>{t(`status.${p.status}`)}</Badge>
                </div>
                <p className="mt-3 text-[17px] leading-relaxed text-white/80">
                  <span className="font-semibold text-text-primary">{t('goal')}:</span> {p.goal}
                </p>
                <div className="mt-5 flex items-center gap-3 text-xs text-text-muted">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-white/[0.08]">
                    <div className="h-full rounded-pill bg-accent" style={{ width: `${(done / Math.max(1, p.items.length)) * 100}%` }} />
                  </div>
                  <span className="num-display">
                    {done}/{p.items.length}
                  </span>
                </div>
                <ul className="mt-5 space-y-2.5 text-[15px]">
                  {p.items.map((it) => (
                    <li key={it.text} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                          it.done ? 'bg-accent text-white' : 'ring-hair'
                        )}
                      >
                        {it.done && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className={it.done ? 'text-text-primary' : 'text-text-muted'}>
                        {it.text}
                        <span className="sr-only">{it.done ? ` (${t('status.done')})` : ''}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 border-t border-border pt-4 text-sm text-text-muted">
                  <span className="font-semibold text-text-primary">{t('exit')}:</span> {p.exit}
                </p>
              </div>
            </div>
          </section>
        );
      })}

      <DocSection id="later" title={t('later_title')}>
        <ul className="list-disc space-y-2 pl-6 marker:text-text-dim">
          {(t.raw('later') as string[]).map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p>
          <Link href="/whitepaper" className="text-accent underline underline-offset-4">
            {t('whitepaper_link')}
          </Link>
        </p>
      </DocSection>
    </DocLayout>
  );
}
