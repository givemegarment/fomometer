import { getTranslations } from 'next-intl/server';
import { DocLayout } from '@/components/docs/doc-layout';
import { DocSection } from '@/components/doc-section';

type Section = { id: string; title: string; body: string[] };

/** Terms and privacy: sections from the `legal.<page>` messages, one paragraph per entry. */
export async function LegalPage({ page }: { page: 'terms' | 'privacy' }) {
  const t = await getTranslations(`legal.${page}`);
  const tl = await getTranslations('legal');
  const sections = t.raw('sections') as Section[];
  return (
    <DocLayout
      kicker={tl('updated', { date: tl('date') })}
      title={t('title')}
      lede={t('intro')}
      tocLabel={tl('toc')}
      toc={sections.map((s) => ({ id: s.id, title: s.title }))}
    >
      {sections.map((s) => (
        <DocSection key={s.id} id={s.id} title={s.title}>
          {s.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </DocSection>
      ))}
    </DocLayout>
  );
}
