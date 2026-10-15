'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Check, Copy, ExternalLink, Star } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { Price } from '@/components/ui/price';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS, SWR_INTERVALS } from '@/lib/swr-keys';
import { fmtPct, fmtUSD, pctTone, fmtTimeAgo, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useWatchlist } from '@/lib/watchlist';
import { FACTORS } from '@/lib/factors';

/** Factor bars are capped here: values are z-scores, beyond ±3 is "far from the rest". */
const FACTOR_CAP = 3;
/** Engine default BUY level; replaced by the live threshold once /api/strategy answers. */
const DEFAULT_BUY_TH = 0.7;

type EventType = 'buy_trigger' | 'sell_trigger' | 'fomo_spike';
type TokenDetail = {
  token: {
    address: string;
    symbol: string;
    name: string;
    image_url: string | null;
    price_usd: number | null;
    price_change_h24: number | null;
    liquidity_usd: number | null;
    fdv: number | null;
    pair_address: string | null;
  };
  history: Array<{ time: number; price: number; score: number | null }>;
  factors: number[];
  events: Array<{ time: number; event_type: EventType; score: number; prev_score: number | null }>;
};

const EVENT_COLOR: Record<EventType, string> = {
  buy_trigger: '#1FCB64',
  sell_trigger: '#FF5A5F',
  fomo_spike: '#F1BA4A'
};

/** Token page: chart and signal history on the left, score, numbers and factors in a right rail. */
export function TokenDetailClient({ address }: { address: string }) {
  const t = useTranslations('token_detail');
  const tSig = useTranslations('signals');
  const { data, isLoading } = useSWR<TokenDetail>(SWR_KEYS.token(address), fetcher, { refreshInterval: SWR_INTERVALS.token });
  const { data: strategy } = useSWR<{ settings: { buy_th: number | null; min_liquidity_usd: number | null } | null }>(SWR_KEYS.strategy, fetcher, {
    refreshInterval: 300_000
  });
  const watchlist = useWatchlist();
  const watched = watchlist.has(address);

  const buyTh = strategy?.settings?.buy_th ?? DEFAULT_BUY_TH;
  const score = data?.history?.[data.history.length - 1]?.score ?? null;
  const minLiq = strategy?.settings?.min_liquidity_usd ?? null;
  const belowFilter = minLiq != null && data?.token != null && (data.token.liquidity_usd ?? 0) < minLiq;
  const typeLabel = (e: EventType) => (e === 'buy_trigger' ? tSig('type_buy') : e === 'sell_trigger' ? tSig('type_sell') : tSig('type_fomo'));

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t('back')}
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Right rail first on mobile: who this is and how it scores. */}
        <aside className="space-y-4 lg:sticky lg:top-16 lg:order-2 lg:self-start">
          <section className="ring-hair rounded-xl bg-bg-card p-5">
            <div className="flex items-start gap-3">
              <TokenAvatar src={data?.token.image_url} symbol={data?.token.symbol ?? ''} size="lg" />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[26px] font-semibold leading-tight tracking-[-0.02em]">{data?.token.symbol || shortenAddress(address)}</h1>
                <p className="truncate text-sm text-text-muted">{data?.token.name ?? ''}</p>
                <CopyAddress address={address} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => watchlist.toggle(address)}
              aria-pressed={watched}
              className={cn(
                'mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors duration-150 ease-snap',
                watched ? 'bg-accent-deep text-accent' : 'bg-white/[0.06] text-text-primary hover:bg-white/[0.1]'
              )}
            >
              <Star className={cn('h-4 w-4', watched && 'fill-accent')} aria-hidden />
              {watched ? t('unwatch') : t('watch')}
            </button>
          </section>

          <section className="ring-hair rounded-xl bg-bg-card p-5" aria-labelledby="score-title">
            <p id="score-title" className="label">{t('score_title')}</p>
            <p className={cn('num-display mt-1 text-6xl font-semibold tracking-[-0.03em]', score != null && score >= buyTh ? 'text-accent' : 'text-text-primary')}>
              {score == null ? '·' : Math.round(score * 100)}
            </p>
            <div className="relative mt-4 h-2 rounded-pill bg-white/[0.08]">
              <div
                className={cn('h-full rounded-pill transition-[width] duration-700 ease-snap', score != null && score >= buyTh ? 'bg-accent' : 'bg-white/50')}
                style={{ width: `${Math.max(0, Math.min(100, (score ?? 0) * 100))}%` }}
              />
              <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded bg-white" style={{ left: `${buyTh * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-text-dim">{t('buy_level', { th: Math.round(buyTh * 100) })}</p>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">{t('score_note')}</p>
            {belowFilter && (
              <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                {t('below_filter', { liq: fmtUSD(minLiq, { compact: true }) })}
              </p>
            )}
          </section>

          <section className="grid grid-cols-2 gap-2">
            <Tile label={t('stat_price')}>
              <Price value={data?.token.price_usd} className="num-display" />
            </Tile>
            <Tile label={t('stat_24h')}>
              <span
                className={cn(
                  'num-display',
                  pctTone(data?.token.price_change_h24) === 'up' ? 'text-success' : pctTone(data?.token.price_change_h24) === 'down' ? 'text-danger' : ''
                )}
              >
                {fmtPct(data?.token.price_change_h24 ?? null, { sign: true, digits: 1 })}
              </span>
            </Tile>
            <Tile label={t('stat_liquidity')}>
              <span className="num-display">{fmtUSD(data?.token.liquidity_usd ?? null, { compact: true })}</span>
            </Tile>
            <Tile label={t('stat_fdv')}>
              <span className="num-display">{fmtUSD(data?.token.fdv ?? null, { compact: true })}</span>
            </Tile>
          </section>

          <section className="flex flex-wrap gap-2">
            {[
              ['DexScreener', `https://dexscreener.com/solana/${address}`],
              ['Birdeye', `https://birdeye.so/token/${address}?chain=solana`],
              ['Solscan', `https://solscan.io/token/${address}`]
            ].map(([name, href]) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="ring-hair inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
              >
                {name}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ))}
          </section>
        </aside>

        <div className="min-w-0 space-y-4 lg:order-1">
          <section className="ring-hair rounded-xl bg-bg-card p-5" aria-labelledby="chart-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="chart-title" className="text-[15px] font-semibold">{t('price_chart')}</h2>
              <ul className="flex gap-4 text-xs text-text-muted">
                {(Object.keys(EVENT_COLOR) as EventType[]).map((k) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: EVENT_COLOR[k] }} />
                    {typeLabel(k)}
                  </li>
                ))}
              </ul>
            </div>
            <PriceChart data={data} loading={isLoading} emptyLabel={t('no_price')} />
          </section>

          <FactorBars values={data?.factors} />

          <section className="ring-hair overflow-hidden rounded-xl bg-bg-card" aria-labelledby="events-title">
            <h2 id="events-title" className="px-5 pb-3 pt-5 text-[15px] font-semibold">{t('signal_events')}</h2>
            {!data?.events?.length ? (
              <p className="px-5 pb-6 text-sm text-text-muted">{t('no_events')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border">
                    <th scope="col" className="label px-5 py-2 text-left">{t('col_signal')}</th>
                    <th scope="col" className="label px-3 py-2 text-left">{t('col_when')}</th>
                    <th scope="col" className="label px-5 py-2 text-right">{t('col_score')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.events.slice(0, 20).map((e) => (
                    <tr key={`${e.time}-${e.event_type}`}>
                      <td className="px-5 py-2.5">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: EVENT_COLOR[e.event_type] }} />
                          {typeLabel(e.event_type)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-text-muted">{fmtTimeAgo(e.time * 1000, Date.now())}</td>
                      <td className="num-display px-5 py-2.5 text-right">
                        <span className="text-text-dim">{e.prev_score == null ? '·' : Math.round(e.prev_score * 100)}</span>
                        <span className="sr-only"> {t('prev_score')} </span>
                        <span aria-hidden className="mx-1.5 text-text-dim">→</span>
                        <span className={cn(e.score >= buyTh && 'text-accent')}>{Math.round(e.score * 100)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ring-hair rounded-lg bg-bg-card px-4 py-3">
      <p className="label">{label}</p>
      <p className="mt-1 text-lg font-semibold">{children}</p>
    </div>
  );
}

function CopyAddress({ address }: { address: string }) {
  const t = useTranslations('token_detail');
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(address).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="num-display mt-1 inline-flex items-center gap-1.5 text-xs text-text-dim transition-colors hover:text-text-primary"
      aria-label={t('copy')}
    >
      {shortenAddress(address, 6, 6)}
      {copied ? <Check className="h-3 w-3 text-accent" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
    </button>
  );
}

/** Each factor as a bar from the centre: right = above the average tracked token, left = below. */
function FactorBars({ values }: { values: number[] | undefined }) {
  const t = useTranslations('token_detail');
  const tf = useTranslations('factors');
  return (
    <section className="ring-hair rounded-xl bg-bg-card p-5" aria-labelledby="factors-title">
      <h2 id="factors-title" className="text-[15px] font-semibold">{t('factors_title')}</h2>
      <p className="mt-1 text-xs text-text-dim">{t('factors_note', { cap: FACTOR_CAP })}</p>
      <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {FACTORS.map((f, i) => {
          const raw = values?.[i];
          const v = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(-FACTOR_CAP, Math.min(FACTOR_CAP, raw)) : 0;
          const width = (Math.abs(v) / FACTOR_CAP) * 50;
          return (
            <li key={f.key} className="grid grid-cols-[7.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-[13px]" title={tf(`${f.key}.hint`)}>
              <span className={cn('truncate', f.inScore ? 'text-text-primary' : 'text-text-muted')}>
                {tf(`${f.key}.short`)}
                {f.inScore && <span className="sr-only"> ({t('in_score')})</span>}
              </span>
              <span aria-hidden className="relative h-1.5 rounded-pill bg-white/[0.06]">
                <span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
                <span
                  className={cn('absolute inset-y-0 rounded-pill', v >= 0 ? 'bg-accent' : 'bg-danger')}
                  style={v >= 0 ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
                />
              </span>
              <span className="num-display text-right text-text-muted">{values ? `${v > 0 ? '+' : ''}${v.toFixed(1)}` : '·'}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-xs text-text-dim">
        <span aria-hidden className="h-2 w-2 rounded-full bg-text-primary" />
        {t('in_score_note')}
      </p>
    </section>
  );
}

function PriceChart({ data, loading, emptyLabel }: { data: TokenDetail | undefined; loading: boolean; emptyLabel: string }) {
  const points = (data?.history ?? []).map((p) => ({ t: p.time * 1000, price: p.price }));
  if (loading) return <div className="skeleton mt-4 h-80 rounded-lg" />;
  if (points.length < 2) return <div className="mt-4 flex h-80 items-center justify-center text-sm text-text-muted">{emptyLabel}</div>;

  const first = points[0]!.t;
  // Mark each event on the price at that minute (nearest snapshot at or before it).
  const marks = (data?.events ?? [])
    .filter((e) => e.time * 1000 >= first)
    .map((e) => {
      const at = e.time * 1000;
      let p = points[0]!;
      for (const q of points) {
        if (q.t <= at) p = q;
        else break;
      }
      return { t: p.t, price: p.price, color: EVENT_COLOR[e.event_type] };
    });

  return (
    <div className="mt-4 h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fill: '#8A8E95', fontSize: 11 }}
            tickFormatter={(v) => new Date(v).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            stroke="rgba(255,255,255,0.08)"
            minTickGap={40}
          />
          <YAxis
            domain={[(min: number) => min * 0.98, (max: number) => max * 1.02]}
            tick={{ fill: '#8A8E95', fontSize: 11 }}
            tickFormatter={(v: number) => '$' + v.toLocaleString('en-US', { maximumSignificantDigits: 3 })}
            stroke="rgba(255,255,255,0.08)"
            width={80}
            orientation="right"
          />
          <Tooltip
            contentStyle={{ background: '#222225', border: 'none', borderRadius: 12, color: '#FFFFFF', fontSize: 12, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
            labelFormatter={(v) => new Date(v as number).toLocaleString('en-US', { hour12: false })}
            formatter={(value: number) => [fmtUSD(value), 'Price']}
          />
          <Line type="linear" dataKey="price" stroke="#FFFFFF" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          {marks.map((m, i) => (
            <ReferenceDot key={i} x={m.t} y={m.price} r={4} fill={m.color} stroke="#141415" strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
