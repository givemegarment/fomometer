import { getTranslations } from 'next-intl/server';

const STEPS = ['collect', 'measure', 'score'] as const;

export async function LandingSteps() {
  const t = await getTranslations('landing');
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="steps-title">
      <h2 id="steps-title" className="text-2xl font-semibold tracking-tight">
        {t('steps_title')}
      </h2>
      <ol className="mt-8 grid gap-8 md:grid-cols-3">
        {STEPS.map((key, i) => (
          <li key={key} className="border-t border-border pt-5">
            <span className="num-display text-sm text-text-muted">0{i + 1}</span>
            <h3 className="mt-2 text-lg font-semibold">{t(`steps.${key}.title`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">{t(`steps.${key}.body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
