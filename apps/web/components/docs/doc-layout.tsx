import { SiteNav } from '@/components/landing/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { DocToc } from '@/components/docs/doc-toc';

/**
 * Long-form pages (method, whitepaper, roadmap): centered intro on the hero gradient, then a
 * sticky table of contents beside a 720px reading column.
 */
export function DocLayout({
  kicker,
  title,
  lede,
  toc,
  tocLabel,
  children
}: {
  kicker: string;
  title: string;
  lede?: string;
  toc: Array<{ id: string; title: string }>;
  tocLabel: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNav />
      <main>
        <header className="relative overflow-hidden px-5 pb-14 pt-16 text-center sm:pb-20 sm:pt-24">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_50%_0%,rgba(42,42,86,0.55),transparent_70%)]" />
          <span className="ring-hair inline-flex rounded-pill bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium">{kicker}</span>
          <h1 className="mt-5 text-display-xl">{title}</h1>
          {lede && <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/80">{lede}</p>}
        </header>
        <div className="mx-auto grid max-w-[1100px] gap-10 px-5 pb-24 lg:grid-cols-[220px_minmax(0,720px)] lg:justify-center lg:gap-16">
          <DocToc items={toc} label={tocLabel} />
          <article className="min-w-0 space-y-16">{children}</article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
