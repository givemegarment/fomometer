import { SiteNav } from '@/components/landing/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { LandingHero } from '@/components/landing/hero';
import { TickerMarquee } from '@/components/landing/ticker-marquee';
import { LandingFacts } from '@/components/landing/facts';
import { LandingTransparency } from '@/components/landing/transparency';
import { LandingSteps } from '@/components/landing/steps';
import { RecordPanel } from '@/components/landing/record-panel';
import { LandingFaq } from '@/components/landing/faq';
import { StickyCta } from '@/components/landing/sticky-cta';

export const runtime = 'edge';

export default function HomePage() {
  return (
    <>
      <SiteNav overlay />
      <main>
        <LandingHero />
        <TickerMarquee />
        <LandingFacts />
        <LandingTransparency />
        <LandingSteps />
        <RecordPanel />
        <LandingFaq />
      </main>
      <SiteFooter />
      <StickyCta />
    </>
  );
}
