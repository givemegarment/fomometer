import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { LandingHero } from '@/components/landing/hero';
import { LandingSteps } from '@/components/landing/steps';
import { LandingLimits } from '@/components/landing/limits';

export const runtime = 'edge';

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <LandingHero />
        <LandingSteps />
        <LandingLimits />
      </main>
      <SiteFooter />
    </>
  );
}
