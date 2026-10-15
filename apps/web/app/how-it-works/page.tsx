import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SiteNav } from '@/components/landing/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { FACTORS } from '@/lib/factors';

export const runtime = 'edge';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('method');
  return { title: t('title'), description: t('meta_description') };
}

const SECTIONS = ['data', 'factors', 'score', 'signals', 'gates', 'record', 'limits'] as const;
const SIGNALS = ['buy', 'sell', 'fomo'] as const;

export default async function HowItWorksPage() {
  const t = await getTranslations('method');
  const tf = await getTranslations('factors');

  return (
    <>
      <SiteNav />
      <main>
      <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-5 text-lg leading-relaxed text-text-muted">{t('intro')}</p>

        <nav aria-label={t('toc')} className="mt-8 rounded-lg border border-border bg-bg-card p-5">
          <p className="text-sm font-semibold">{t('toc')}</p>
          <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {SECTIONS.map((s, i) => (
              <li key={s}>
                <a href={`#${s}`} className="text-text-muted hover:text-text-primary">
                  {i + 1}. {t(`${s}.title`)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-14">
          <Section id="data" title={t('data.title')}>
            <p>{t('data.body')}</p>
          </Section>

          <Section id="factors" title={t('factors.title')}>
            <p>{t('factors.body')}</p>
            <div className="mt-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-card text-xs text-text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">{t('factors.col_factor')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('factors.col_meaning')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('factors.col_in_score')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {FACTORS.map((f) => (
                    <tr key={f.key} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-text-primary">{tf(`${f.key}.label`)}</td>
                      <td className="px-4 py-3 text-text-muted">{tf(`${f.key}.hint`)}</td>
                      <td className="px-4 py-3 text-text-muted">{f.inScore ? t('factors.yes') : t('factors.no')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="score" title={t('score.title')}>
            <p>{t('score.body')}</p>
            <p>{t('score.regime')}</p>
          </Section>

          <Section id="signals" title={t('signals.title')}>
            <p>{t('signals.body')}</p>
            <dl className="mt-4 space-y-4">
              {SIGNALS.map((s) => (
                <div key={s} className="rounded-lg border border-border bg-bg-card p-4">
                  <dt className="font-semibold text-text-primary">{t(`signals.${s}.name`)}</dt>
                  <dd className="mt-1 text-text-muted">{t(`signals.${s}.rule`)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4">
              {t('signals.thresholds')}{' '}
              <Link href="/dashboard/strategy" className="text-accent underline underline-offset-2">
                {t('signals.thresholds_link')}
              </Link>
            </p>
          </Section>

          <Section id="gates" title={t('gates.title')}>
            <p>{t('gates.body')}</p>
          </Section>

          <Section id="record" title={t('record.title')}>
            <p>{t('record.body')}</p>
          </Section>

          <Section id="limits" title={t('limits.title')}>
            <p>{t('limits.body')}</p>
          </Section>
        </div>
      </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-4 space-y-4 leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}
