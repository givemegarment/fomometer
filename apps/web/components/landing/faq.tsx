import { getTranslations } from 'next-intl/server';
import { ChevronDown } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { FEE_PCT, TRADING_ENABLED } from '@/lib/trade';

/** Accordion on native details/summary: works without JavaScript and with the keyboard. */
export async function LandingFaq() {
  const t = await getTranslations('landing');
  const tTrade = await getTranslations('trade');
  // A copy: t.raw hands back the loaded messages, which must not be mutated.
  const items = [...(t.raw('faq') as Array<{ q: string; a: string }>)];
  // Only claim buying works when it is switched on.
  if (TRADING_ENABLED) items.push({ q: tTrade('faq_q'), a: tTrade('faq_a', { fee: FEE_PCT }) });
  return (
    <section className="mx-auto max-w-[720px] px-5 py-24 sm:py-32">
      <Reveal className="text-center">
        <h2 className="text-display-lg">{t('faq_title')}</h2>
      </Reveal>
      <div className="mt-10 space-y-2">
        {items.map((it, i) => (
          <Reveal key={it.q} delay={i * 40}>
            <details className="group ring-hair rounded-lg bg-bg-card open:bg-bg-elev">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                {it.q}
                <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-300 ease-snap group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-[15px] leading-relaxed text-text-muted">{it.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
