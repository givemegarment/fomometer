import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DocLayout } from '@/components/docs/doc-layout';
import { DocCard, DocSection, DocTable } from '@/components/doc-section';
import { FACTORS } from '@/lib/factors';
import { CHAIN_RECORD_ADDRESS, CHAIN_RECORD_ON, solscanAccount } from '@/lib/chain';

export const runtime = 'edge';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('method');
  return { title: t('title'), description: t('meta_description') };
}

// 'onchain' only once the on-chain record has started (lib/chain.ts).
const SECTIONS = ['data', 'factors', 'score', 'signals', 'gates', 'record', ...(CHAIN_RECORD_ON ? (['onchain'] as const) : []), 'limits'] as const;
const SIGNALS = ['buy', 'sell', 'fomo'] as const;

export default async function HowItWorksPage() {
  const t = await getTranslations('method');
  const tf = await getTranslations('factors');
  const TH = 'label px-4 py-3';

  return (
    <DocLayout
      kicker={t('kicker')}
      title={t('title')}
      lede={t('intro')}
      tocLabel={t('toc')}
      toc={SECTIONS.map((s) => ({ id: s, title: t(`${s}.title`) }))}
    >
      <DocSection id="data" title={t('data.title')}>
        <p>{t('data.body')}</p>
      </DocSection>

      <DocSection id="factors" title={t('factors.title')}>
        <p>{t('factors.body')}</p>
        <DocTable>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={TH}>{t('factors.col_factor')}</th>
              <th scope="col" className={TH}>{t('factors.col_meaning')}</th>
              <th scope="col" className={TH}>{t('factors.col_in_score')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {FACTORS.map((f) => (
              <tr key={f.key} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-text-primary">{tf(`${f.key}.label`)}</td>
                <td className="px-4 py-3 text-text-muted">{tf(`${f.key}.hint`)}</td>
                <td className={f.inScore ? 'px-4 py-3 font-medium text-accent' : 'px-4 py-3 text-text-dim'}>
                  {f.inScore ? t('factors.yes') : t('factors.no')}
                </td>
              </tr>
            ))}
          </tbody>
        </DocTable>
      </DocSection>

      <DocSection id="score" title={t('score.title')}>
        <p>{t('score.body')}</p>
        <p>{t('score.regime')}</p>
      </DocSection>

      <DocSection id="signals" title={t('signals.title')}>
        <p>{t('signals.body')}</p>
        <div className="space-y-3">
          {SIGNALS.map((s) => (
            <DocCard key={s} title={t(`signals.${s}.name`)}>
              {t(`signals.${s}.rule`)}
            </DocCard>
          ))}
        </div>
        <p>
          {t('signals.thresholds')}{' '}
          <Link href="/dashboard/strategy" className="text-accent underline underline-offset-4">
            {t('signals.thresholds_link')}
          </Link>
        </p>
      </DocSection>

      <DocSection id="gates" title={t('gates.title')}>
        <p>{t('gates.body')}</p>
      </DocSection>

      <DocSection id="record" title={t('record.title')}>
        <p>{t('record.body')}</p>
      </DocSection>

      {CHAIN_RECORD_ON && (
        <DocSection id="onchain" title={t('onchain.title')}>
          <p>{t('onchain.body')}</p>
          {/* Raw: the angle brackets would otherwise be read as rich-text tags. */}
          <p className="font-mono text-sm">{t.raw('onchain.format') as string}</p>
          <p>
            <a href={solscanAccount(CHAIN_RECORD_ADDRESS)} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
              {t('onchain.wallet')}
            </a>
          </p>
        </DocSection>
      )}

      <DocSection id="limits" title={t('limits.title')}>
        <p>{t('limits.body')}</p>
      </DocSection>
    </DocLayout>
  );
}
