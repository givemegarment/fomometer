import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { cn } from '@/lib/cn';

type Step = { title: string; body: string };

const CARDS = [
  'bg-[linear-gradient(180deg,#8E9096_0%,#55575D_100%)]',
  'bg-[linear-gradient(359deg,#889FD8_-29%,#3F5FA8_40%,#132362_97%)]',
  'bg-[linear-gradient(354deg,#FFE4C8_23%,#A48B6E_69%,#0C0600_109%)]',
  'bg-[linear-gradient(170deg,#1E5A47_0%,#2E7D66_60%,#8FC9B8_130%)]'
];

/** Four colored cards with a number chip, after the reference's feature cards; a small data motif in each. */
export async function LandingSteps() {
  const t = await getTranslations('landing');
  const steps = t.raw('steps') as Step[];
  return (
    <section className="mx-auto max-w-[900px] px-5 py-24 sm:py-32">
      <Reveal className="text-center">
        <h2 className="text-display-lg">{t('steps_title')}</h2>
      </Reveal>
      <ol className="mt-12 grid gap-4 sm:grid-cols-2">
        {steps.map((s, i) => (
          <Reveal as="li" key={s.title} delay={i * 80} className={cn('relative flex min-h-[340px] flex-col overflow-hidden rounded-2xl p-7', CARDS[i])}>
            <h3 className={cn('text-[28px] font-semibold leading-tight tracking-[-0.02em]', i === 2 && 'text-[#1C130A]')}>{s.title}</h3>
            <p className={cn('mt-3 max-w-[22rem] text-[15px] leading-relaxed', i === 2 ? 'text-[#1C130A]/80' : 'text-white/85')}>{s.body}</p>
            <Motif kind={i} />
            <span className="num-display absolute bottom-6 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-xs font-semibold text-white backdrop-blur">
              0{i + 1}
            </span>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/** Abstract data drawings instead of 3D renders: rows, factor bars, a score dial, an outcome line. */
function Motif({ kind }: { kind: number }) {
  const common = 'pointer-events-none absolute bottom-0 right-0 w-[70%] opacity-90';
  if (kind === 0)
    return (
      <svg aria-hidden viewBox="0 0 200 120" className={common}>
        {[0, 1, 2, 3, 4].map((r) => (
          <g key={r} transform={`translate(20 ${18 + r * 20})`}>
            <circle cx="6" cy="6" r="6" fill="white" fillOpacity={0.35} />
            <rect x="18" y="2" width={60 + ((r * 37) % 70)} height="8" rx="4" fill="white" fillOpacity={0.25} />
          </g>
        ))}
      </svg>
    );
  if (kind === 1)
    return (
      <svg aria-hidden viewBox="0 0 200 120" className={common}>
        {[0.4, 0.8, 0.55, 0.95, 0.3, 0.7, 0.5].map((h, i) => (
          <rect key={i} x={20 + i * 24} y={110 - h * 90} width="14" height={h * 90} rx="3" fill="white" fillOpacity={0.18 + h * 0.3} />
        ))}
      </svg>
    );
  if (kind === 2)
    return (
      <svg aria-hidden viewBox="0 0 200 120" className={common}>
        <path d="M40 110 A60 60 0 0 1 160 110" fill="none" stroke="#1C130A" strokeOpacity={0.18} strokeWidth="14" strokeLinecap="round" />
        <path d="M40 110 A60 60 0 0 1 145 70" fill="none" stroke="#1C130A" strokeOpacity={0.7} strokeWidth="14" strokeLinecap="round" />
        <text x="100" y="105" textAnchor="middle" fontSize="28" fontWeight="600" fill="#1C130A" fillOpacity={0.8}>79</text>
      </svg>
    );
  return (
    <svg aria-hidden viewBox="0 0 200 120" className={common}>
      <polyline points="10,90 40,80 70,86 100,60 130,66 160,40 190,30" fill="none" stroke="white" strokeOpacity={0.7} strokeWidth="3" strokeLinejoin="round" />
      {[[100, 60], [160, 40]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="6" fill="#00B24B" stroke="white" strokeWidth="2" />
      ))}
    </svg>
  );
}
