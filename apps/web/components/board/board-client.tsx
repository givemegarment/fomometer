'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { Sparkline } from '@/components/ui/sparkline';
import { FilterChips } from '@/components/ui/filter-chips';
import { Price } from '@/components/ui/price';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS, SWR_INTERVALS } from '@/lib/swr-keys';
import { fmtPace, fmtPct, fmtUSD, pctTone, shortenAddress } from '@/lib/format';
import { useWatchlist } from '@/lib/watchlist';
import { cn } from '@/lib/cn';
import { BUY_FRESH_SEC, TRADING_ENABLED } from '@/lib/trade';
import { TradeButton } from '@/components/trade/trade-button';

type Filter = 'all' | 'score' | 'liq' | 'fomo';

type Row = {
  address: string;
  symbol: string;
  name: string;
  image_url: string | null;
  price_usd: number | null;
  price_change_h24: number | null;
  liquidity_usd: number | null;
  fdv: number | null;
  fomo_factor: number | null;
  /** Raw burst factor: 5-minute volume pace over the hourly pace, minus 1 (clamped to 5). */
  fomo_raw: number | null;
  score: number | null;
  spark: number[];
};

type Horizon = { n: number; favorable: number | null; median_pct: number | null };
type Group = { n: number; horizons: Record<'15m' | '1h' | '4h', Horizon> };
type Strategy = {
  settings: { buy_th: number | null; min_liquidity_usd: number | null } | null;
  record: { days: number; events: { buy_trigger: Group }; baseline: Group } | null;
};
type Overview = { buy_signals_1h: number };
type BuyEvents = { events: Array<{ address: string; time: number }> };

/** Below this many priced outcomes a share is noise. Same rule as the Strategy page. */
const MIN_SAMPLE = 20;

/**
 * Home page: the live board. A strip of facts (how many tokens, how many BUY signals, and
 * how BUY has done against any token), then every tracked token ranked by score.
 */
export function BoardClient() {
  const t = useTranslations('board');
  const [filter, setFilter] = useState<Filter>('all');
  const watchlist = useWatchlist();

  const { data, isLoading } = useSWR<{ rows: Row[] }>(SWR_KEYS.scanner(filter === 'all' ? undefined : filter), fetcher, {
    refreshInterval: SWR_INTERVALS.scanner,
    keepPreviousData: true
  });
  const { data: strategy } = useSWR<Strategy>(SWR_KEYS.strategy, fetcher, { refreshInterval: 300_000 });
  const { data: overview } = useSWR<Overview>(SWR_KEYS.overview, fetcher, { refreshInterval: SWR_INTERVALS.overview });
  // Tokens with a BUY signal in the last hour get a Buy button; the same rule as the Signals page.
  const { data: buys } = useSWR<BuyEvents>(TRADING_ENABLED ? SWR_KEYS.signals('buy') : null, fetcher, { refreshInterval: SWR_INTERVALS.signals });
  const freshBuy = new Set((buys?.events ?? []).filter((e) => Date.now() / 1000 - e.time < BUY_FRESH_SEC).map((e) => e.address));

  const buyTh = strategy?.settings?.buy_th ?? null;
  const minLiq = strategy?.settings?.min_liquidity_usd ?? null;
  const buy4h = strategy?.record?.events.buy_trigger.horizons['4h'];
  const base4h = strategy?.record?.baseline.horizons['4h'];

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: t('filter_all') },
    { id: 'score', label: t('filter_score') },
    { id: 'liq', label: t('filter_liq') },
    { id: 'fomo', label: t('filter_burst') }
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-display-lg">{t('title')}</h1>

      <ul className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
        <Fact label={t('fact_tracked')} value={data ? String(data.rows.length) : null} />
        <Fact label={t('fact_buys')} value={overview ? String(overview.buy_signals_1h) : null} />
        <Fact
          label={t('fact_buy_4h')}
          value={share(buy4h)}
          note={buy4h ? t('fact_n', { n: buy4h.n, days: strategy?.record?.days ?? 7 }) : undefined}
          href="/dashboard/strategy"
        />
        <Fact
          label={t('fact_any_4h')}
          value={share(base4h)}
          note={base4h ? t('fact_n', { n: base4h.n, days: strategy?.record?.days ?? 7 }) : undefined}
          href="/dashboard/strategy"
        />
      </ul>

      <FilterChips items={filters} value={filter} onChange={setFilter} label={t('filter_label')} />

      <div className="relative overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-card">
            <tr className="border-b border-border">
              <th scope="col" className="label w-8 px-2 py-2 text-left sm:w-10 sm:px-3">#</th>
              <th scope="col" className="label px-2 py-2 text-left sm:px-3">{t('col_token')}</th>
              <th scope="col" className="label px-2 py-2 text-right sm:px-3">{t('col_score')}</th>
              <th scope="col" className="label hidden px-3 py-2 text-right md:table-cell">{t('col_price')}</th>
              <th scope="col" className="label px-2 py-2 text-right sm:px-3">{t('col_24h')}</th>
              <th scope="col" className="label hidden px-3 py-2 text-right lg:table-cell">{t('col_liq')}</th>
              <th scope="col" className="label hidden px-3 py-2 text-right xl:table-cell">{t('col_fdv')}</th>
              <th scope="col" className="label hidden px-3 py-2 text-right md:table-cell" title={t('col_burst_hint')}>
                {t('col_burst')}
              </th>
              <th scope="col" className="label hidden px-3 py-2 text-right sm:table-cell">{t('col_30m')}</th>
              {TRADING_ENABLED && (
                <th scope="col" className="hidden px-2 py-2 sm:table-cell">
                  <span className="sr-only">{t('col_buy')}</span>
                </th>
              )}
              <th scope="col" className="w-10 px-2 py-2">
                <span className="sr-only">{t('watch_add')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && !data
              ? Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={TRADING_ENABLED ? 11 : 10} className="px-3 py-2.5">
                      <div className="skeleton h-5 rounded" />
                    </td>
                  </tr>
                ))
              : data?.rows.map((row, i) => {
                  const lowLiq = minLiq != null && (row.liquidity_usd ?? 0) < minLiq;
                  const tone = pctTone(row.price_change_h24);
                  const watched = watchlist.has(row.address);
                  return (
                    <tr key={row.address} className={cn('transition-colors hover:bg-bg-card', lowLiq && 'text-text-muted')}>
                      <td className="num px-2 py-2 text-xs text-text-dim sm:px-3">{i + 1}</td>
                      <td className="max-w-[9rem] px-2 py-2 sm:max-w-[16rem] sm:px-3">
                        <Link href={`/dashboard/token/${row.address}`} className="group flex items-center gap-2.5">
                          <TokenAvatar src={row.image_url} symbol={row.symbol} className={cn(lowLiq && 'opacity-60')} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-text-primary group-hover:text-accent">
                              {row.symbol || shortenAddress(row.address)}
                            </span>
                            <span className="block truncate text-xs text-text-dim">
                              {lowLiq ? t('low_liq_tag') : row.name}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-2 py-2 sm:px-3">
                        <ScoreCell score={row.score} buyTh={buyTh} muted={lowLiq} />
                      </td>
                      <td className="num hidden px-3 py-2 text-right md:table-cell">
                        <Price value={row.price_usd} />
                      </td>
                      <td
                        className={cn(
                          'num px-2 py-2 text-right sm:px-3',
                          tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-text-muted'
                        )}
                      >
                        {fmtPct(row.price_change_h24, { sign: true, digits: Math.abs(row.price_change_h24 ?? 0) >= 1000 ? 0 : 1 })}
                      </td>
                      <td className="num hidden px-3 py-2 text-right text-text-muted lg:table-cell">
                        {fmtUSD(row.liquidity_usd, { compact: true })}
                      </td>
                      <td className="num hidden px-3 py-2 text-right text-text-muted xl:table-cell">
                        {fmtUSD(row.fdv, { compact: true })}
                      </td>
                      <td className="num hidden px-3 py-2 text-right text-text-muted md:table-cell">
                        {fmtPace(row.fomo_raw)}
                      </td>
                      <td className="hidden px-3 py-2 sm:table-cell">
                        <Sparkline data={row.spark} width={72} height={20} className="ml-auto" />
                      </td>
                      {TRADING_ENABLED && (
                        <td className="hidden px-2 py-2 text-right sm:table-cell">
                          {/* Every token above the liquidity filter; green when it had a BUY in the last hour. */}
                          {minLiq != null && !lowLiq && (
                            <TradeButton address={row.address} label={t('buy')} size="sm" quiet={!freshBuy.has(row.address)} />
                          )}
                        </td>
                      )}
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => watchlist.toggle(row.address)}
                          aria-pressed={watched}
                          aria-label={watched ? t('watch_remove') : t('watch_add')}
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded transition-colors',
                            watched ? 'text-accent' : 'text-text-dim hover:text-text-primary'
                          )}
                        >
                          <Star className={cn('h-3.5 w-3.5', watched && 'fill-accent')} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {data?.rows.length === 0 && <p className="px-6 py-12 text-center text-sm text-text-muted">{t('empty')}</p>}
      </div>
    </div>
  );
}

function share(h: Horizon | undefined): string | null {
  if (!h) return null;
  if (h.n < MIN_SAMPLE || h.favorable == null) return '·';
  return `${Math.round(h.favorable * 100)}%`;
}

function Fact({ label, value, note, href }: { label: string; value: string | null; note?: string; href?: string }) {
  const body = (
    <>
      <span className="label block">{label}</span>
      <span className="num mt-1 block text-xl text-text-primary">{value ?? <span className="skeleton inline-block h-6 w-10 rounded" />}</span>
      {note && <span className="mt-0.5 block text-xs text-text-dim">{note}</span>}
    </>
  );
  const cls = '[&:not(:first-child)]:border-l [&:not(:first-child)]:border-border max-sm:[&:nth-child(3)]:border-l-0 max-sm:[&:nth-child(n+3)]:border-t';
  return (
    <li className={cls}>
      {href ? (
        <Link href={href} className="block px-3 py-3 transition-colors hover:bg-bg-card sm:px-4">
          {body}
        </Link>
      ) : (
        <div className="px-3 py-3 sm:px-4">{body}</div>
      )}
    </li>
  );
}

/**
 * Score 0 to 100 with a short bar; it turns green at the BUY threshold, except below the
 * liquidity filter, where the engine fires no signals and a green score would say otherwise.
 */
function ScoreCell({ score, buyTh, muted }: { score: number | null; buyTh: number | null; muted: boolean }) {
  if (score == null) return <span className="num block text-right text-text-dim">·</span>;
  const pct = Math.max(0, Math.min(100, score * 100));
  const hot = !muted && buyTh != null && score >= buyTh;
  return (
    <span className="flex items-center justify-end gap-2">
      <span aria-hidden className="hidden h-1 w-12 overflow-hidden rounded-sm bg-bg-chip sm:block">
        <span className={cn('block h-full', hot ? 'bg-accent' : 'bg-text-dim')} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('num w-6 text-right', hot ? 'text-accent' : 'text-text-primary')}>{pct.toFixed(0)}</span>
    </span>
  );
}
