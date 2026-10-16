import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DocLayout } from '@/components/docs/doc-layout';
import { DocCard, DocSection, DocTable } from '@/components/doc-section';
import { TOKEN_LAUNCHED, TOKEN_MINT, TOKEN_URL } from '@/lib/token';

export const runtime = 'edge';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('whitepaper');
  return { title: t('title'), description: t('meta_description') };
}

const SECTIONS = [
  'summary',
  'problem',
  'product',
  'evidence',
  'principles',
  'model',
  'token',
  'roadmap',
  'risks',
  'disclaimer'
] as const;

type Outcome = { event: string; n?: string; f1: string; m1: string; f4: string; m4: string };
type Named = { name: string; body: string };
type ModelItem = { name: string; for: string; adds: string };
type Param = { k: string; v: string };

const TH = 'label px-4 py-3';
const TD = 'px-4 py-3';

export default async function WhitepaperPage() {
  const t = await getTranslations('whitepaper');
  const paragraphs = (key: string) => (t.raw(key) as string[]).map((p) => <p key={p}>{p}</p>);
  const allTime = t.raw('evidence.all_time') as Outcome[];
  const baseline = t.raw('evidence.baseline') as Outcome[];

  return (
    <DocLayout
      kicker={t('kicker')}
      title={t('title')}
      lede={t('lede')}
      tocLabel={t('toc')}
      toc={SECTIONS.map((s) => ({ id: s, title: t(`${s}.title`) }))}
    >
            <DocSection id="summary" title={t('summary.title')}>
              {paragraphs('summary.body')}
            </DocSection>

            <DocSection id="problem" title={t('problem.title')}>
              {paragraphs('problem.body')}
            </DocSection>

            <DocSection id="product" title={t('product.title')}>
              <p>{t('product.intro')}</p>
              <ol className="list-decimal space-y-2 pl-6 marker:text-text-dim">
                {(t.raw('product.steps') as string[]).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p>
                {t('product.outro')}{' '}
                <Link href="/how-it-works" className="text-accent underline underline-offset-2">
                  {t('product.method_link')}
                </Link>
              </p>
            </DocSection>

            <DocSection id="evidence" title={t('evidence.title')}>
              <p>{t('evidence.intro')}</p>
              <OutcomeTable
                rows={allTime}
                head={[
                  t('evidence.col_event'),
                  t('evidence.col_n'),
                  t('evidence.col_fav_1h'),
                  t('evidence.col_med_1h'),
                  t('evidence.col_fav_4h'),
                  t('evidence.col_med_4h')
                ]}
              />
              <p>{t('evidence.drawdown')}</p>
              <p>{t('evidence.baseline_intro')}</p>
              <OutcomeTable
                rows={baseline}
                head={[
                  t('evidence.col_group'),
                  t('evidence.col_up_1h'),
                  t('evidence.col_med_1h'),
                  t('evidence.col_up_4h'),
                  t('evidence.col_med_4h')
                ]}
              />
              <div className="ring-hair rounded-xl bg-bg-card p-5">
                <p className="font-semibold text-text-primary">{t('evidence.reading_title')}</p>
                <p className="mt-2">{t('evidence.reading')}</p>
              </div>
              <p className="text-sm">{t('evidence.caveats')}</p>
              <p>
                <Link href="/dashboard/strategy" className="text-accent underline underline-offset-2">
                  {t('evidence.live_link')}
                </Link>
              </p>
            </DocSection>

            <DocSection id="principles" title={t('principles.title')}>
              <NamedList items={t.raw('principles.items') as Named[]} />
            </DocSection>

            <DocSection id="model" title={t('model.title')} badge={t('model.badge')}>
              <p>{t('model.intro')}</p>
              <DocTable>
                <thead className="border-b border-border">
                  <tr>
                    <th scope="col" className={TH}>{t('model.col_product')}</th>
                    <th scope="col" className={TH}>{t('model.col_for')}</th>
                    <th scope="col" className={TH}>{t('model.col_adds')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(t.raw('model.items') as ModelItem[]).map((m) => (
                    <tr key={m.name} className="align-top">
                      <th scope="row" className={`${TD} whitespace-nowrap font-medium text-text-primary`}>{m.name}</th>
                      <td className={TD}>{m.for}</td>
                      <td className={TD}>{m.adds}</td>
                    </tr>
                  ))}
                </tbody>
              </DocTable>
              <p>{t('model.note')}</p>
            </DocSection>

            <DocSection id="token" title={t('token.title')} badge={t(TOKEN_LAUNCHED ? 'token.badge_live' : 'token.badge')}>
              <p>{t(TOKEN_LAUNCHED ? 'token.intro_live' : 'token.intro')}</p>
              {TOKEN_LAUNCHED && (
                <p className="break-all">
                  <span className="font-semibold text-text-primary">{t('token.contract')}:</span>{' '}
                  <span className="font-mono text-sm">{TOKEN_MINT}</span>{' · '}
                  <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">
                    {t('token.link')}
                  </a>
                </p>
              )}

              <h3 className="pt-2 font-semibold text-text-primary">{t('token.loop_title')}</h3>
              <ol className="space-y-3">
                {(t.raw('token.loop') as string[]).map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="num-display flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs text-text-primary"
                    >
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>

              <h3 className="pt-2 font-semibold text-text-primary">{t('token.params_title')}</h3>
              <DocTable>
                <tbody className="divide-y divide-border">
                  {(t.raw('token.params') as Param[]).map((p) => (
                    <tr key={p.k} className="align-top">
                      <th scope="row" className={`${TD} whitespace-nowrap font-medium text-text-primary`}>{p.k}</th>
                      <td className={TD}>{p.v}</td>
                    </tr>
                  ))}
                </tbody>
              </DocTable>

              <h3 className="pt-2 font-semibold text-text-primary">{t('token.rules_title')}</h3>
              <ul className="list-disc space-y-2 pl-6 marker:text-text-dim">
                {(t.raw('token.rules') as string[]).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>

              <h3 className="pt-2 font-semibold text-text-primary">{t('token.changes_title')}</h3>
              <ul className="list-disc space-y-2 pl-6 marker:text-text-dim">
                {(t.raw('token.changes') as string[]).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </DocSection>

            <DocSection id="roadmap" title={t('roadmap.title')}>
              <p>{t('roadmap.body')}</p>
              <p>
                <Link href="/roadmap" className="text-accent underline underline-offset-2">
                  {t('roadmap.link')}
                </Link>
              </p>
            </DocSection>

            <DocSection id="risks" title={t('risks.title')}>
              <NamedList items={t.raw('risks.items') as Named[]} />
            </DocSection>

            <DocSection id="disclaimer" title={t('disclaimer.title')}>
              <p>{t('disclaimer.body')}</p>
            </DocSection>
    </DocLayout>
  );
}

function OutcomeTable({ head, rows }: { head: string[]; rows: Outcome[] }) {
  const hasN = rows.some((r) => r.n != null);
  return (
    <DocTable>
      <thead className="border-b border-border">
        <tr>
          {head.map((h, i) => (
            <th key={h} scope="col" className={`${TH} ${i ? 'text-right' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => {
          const cells = hasN ? [r.n ?? '', r.f1, r.m1, r.f4, r.m4] : [r.f1, r.m1, r.f4, r.m4];
          return (
            <tr key={r.event}>
              <th scope="row" className={`${TD} whitespace-nowrap font-medium text-text-primary`}>{r.event}</th>
              {cells.map((c, i) => (
                <td key={i} className={`${TD} num-display whitespace-nowrap text-right`}>
                  {c}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </DocTable>
  );
}

function NamedList({ items }: { items: Named[] }) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <DocCard key={it.name} title={it.name}>
          {it.body}
        </DocCard>
      ))}
    </div>
  );
}
