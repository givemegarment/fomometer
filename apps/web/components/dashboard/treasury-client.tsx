'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS } from '@/lib/swr-keys';
import { fmtTimeAgo, shortenAddress } from '@/lib/format';
import { FEE_MINT_SYMBOLS, POOL_SPLIT, SOL_MINT } from '@/lib/trade';
import { cn } from '@/lib/cn';

type Totals = { fee_mint: string; swaps: number; buys: number; sells: number; from_signal: number; fees: number; volume: number };
type Recent = {
  signature: string;
  block_time: number;
  side: 'buy' | 'sell';
  mint: string;
  symbol: string;
  fee_mint: string;
  fee_ui: number;
  notional_ui: number;
  from_signal: number;
};
type Treasury = {
  referral_account: string;
  balances: Array<{ account: string; mint: string; amount: number }> | null;
  rpc_error: string | null;
  totals: Totals[];
  recent: Recent[];
  updated_at: number | null;
};

const SOLSCAN = 'https://solscan.io';
const sym = (mint: string) => FEE_MINT_SYMBOLS[mint] ?? shortenAddress(mint);

/** Small token amounts keep their significant digits (0.00001 SOL, not 0.00). */
function fmtAmount(n: number): string {
  if (n === 0) return '0';
  if (Math.abs(n) < 1) return String(Number(n.toPrecision(3)));
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/**
 * Treasury: what the referral fee has earned, read from the chain. Totals and swaps come from
 * the labeler's `swaps` table, balances straight from the fee accounts.
 */
export function TreasuryClient() {
  const t = useTranslations('treasury');
  const { data, error } = useSWR<Treasury>(SWR_KEYS.treasury, fetcher, { refreshInterval: 30_000 });

  const sol = data?.totals.find((r) => r.fee_mint === SOL_MINT);
  const all = (data?.totals ?? []).reduce(
    (a, r) => ({ swaps: a.swaps + r.swaps, buys: a.buys + r.buys, sells: a.sells + r.sells, fromSignal: a.fromSignal + r.from_signal }),
    { swaps: 0, buys: 0, sells: 0, fromSignal: 0 }
  );
  const others = (data?.totals ?? []).filter((r) => r.fee_mint !== SOL_MINT);
  const funded = data?.balances?.filter((b) => b.amount > 0) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-display-lg">{t('title')}</h1>
        {data && (
          <a
            href={`${SOLSCAN}/account/${data.referral_account}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
          >
            {t('referral_link')}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>

      {error ? (
        <p className="text-sm text-danger">{t('load_error')}</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t('stat_fees')} note={t('stat_fees_note')} value={data ? `${fmtAmount(sol?.fees ?? 0)} SOL` : null} />
            <Stat label={t('stat_swaps')} note={data ? t('stat_swaps_note', { buys: all.buys, sells: all.sells }) : ''} value={data ? String(all.swaps) : null} />
            <Stat label={t('stat_volume')} note={t('stat_volume_note')} value={data ? `${fmtAmount(sol?.volume ?? 0)} SOL` : null} />
            <Stat
              label={t('stat_signal')}
              note={t('stat_signal_note')}
              value={data ? (all.buys ? t('stat_signal_value', { n: all.fromSignal, total: all.buys }) : '0') : null}
            />
          </section>
          {others.length > 0 && (
            <p className="text-xs text-text-dim">
              {t('other_mints', { list: others.map((r) => `${fmtAmount(r.fees)} ${sym(r.fee_mint)}`).join(', ') })}
            </p>
          )}

          {/* One full-width card: the pool balance on top, the split below in a row, so no column is left half empty. */}
          <Card>
            <CardHeader>
              <CardTitle>{t('split_title')}</CardTitle>
              <p className="max-w-3xl text-sm leading-relaxed text-text-muted">{t('split_note')}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="label">{t('balances_title')}</p>
                {!data ? (
                  <Skeleton className="mt-2 h-9 w-48" />
                ) : data.balances == null ? (
                  <p className="mt-1 text-sm text-danger">{t('balances_error')}</p>
                ) : funded.length === 0 ? (
                  <p className="mt-1 text-sm text-text-muted">{t('balances_empty')}</p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-x-8 gap-y-2">
                    {funded.map((b) => (
                      <li key={b.account} className="flex items-baseline gap-3">
                        <span className="num-display text-2xl font-semibold">
                          {fmtAmount(b.amount)} <span className="text-base text-text-muted">{sym(b.mint)}</span>
                        </span>
                        <a
                          href={`${SOLSCAN}/account/${b.account}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
                        >
                          {shortenAddress(b.account)}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <SplitRow label={t('split_buyback')} pct={POOL_SPLIT.buyback} note={t('split_burned')} />
                <SplitRow label={t('split_rewards')} pct={POOL_SPLIT.rewards} note={t('split_paid')} />
                <SplitRow label={t('split_ops')} pct={POOL_SPLIT.ops} />
              </div>
              <Link href="/whitepaper#token" className="inline-block text-sm text-accent underline underline-offset-2">
                {t('split_link')}
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('recent_title')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!data ? (
                <div className="p-6">
                  <Skeleton className="h-24" />
                </div>
              ) : data.recent.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-text-muted sm:px-6">{t('recent_empty')}</p>
              ) : (
                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-text-muted">
                        <th scope="col" className="px-3 py-3 text-left font-medium sm:px-6">{t('col_when')}</th>
                        <th scope="col" className="px-2 py-3 text-left font-medium sm:px-3">{t('col_side')}</th>
                        <th scope="col" className="px-2 py-3 text-left font-medium sm:px-3">{t('col_token')}</th>
                        <th scope="col" className="hidden px-3 py-3 text-right font-medium sm:table-cell">{t('col_size')}</th>
                        <th scope="col" className="px-2 py-3 text-right font-medium sm:px-3">{t('col_fee')}</th>
                        <th scope="col" className="hidden px-3 py-3 text-center font-medium sm:table-cell">{t('col_signal')}</th>
                        <th scope="col" className="px-3 py-3 text-right font-medium sm:pr-6">
                          <span className="sr-only">{t('col_tx')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.recent.map((r) => (
                        <tr key={r.signature}>
                          <td className="whitespace-nowrap px-3 py-2.5 text-text-muted sm:px-6">{fmtTimeAgo(r.block_time * 1000, Date.now())}</td>
                          <td className={cn('px-2 py-2.5 font-medium sm:px-3', r.side === 'buy' ? 'text-success' : 'text-danger')}>
                            {r.side === 'buy' ? t('side_buy') : t('side_sell')}
                          </td>
                          <td className="max-w-[6rem] truncate px-2 py-2.5 sm:max-w-[10rem] sm:px-3">
                            <Link href={`/dashboard/token/${r.mint}`} className="hover:text-accent">
                              {r.symbol || shortenAddress(r.mint)}
                            </Link>
                          </td>
                          <td className="num-display hidden whitespace-nowrap px-3 py-2.5 text-right sm:table-cell">
                            {fmtAmount(r.notional_ui)} {sym(r.fee_mint)}
                          </td>
                          <td className="num-display whitespace-nowrap px-2 py-2.5 text-right sm:px-3">
                            {fmtAmount(r.fee_ui)} {sym(r.fee_mint)}
                          </td>
                          <td className="hidden px-3 py-2.5 text-center sm:table-cell">
                            {r.from_signal ? <span className="text-success">{t('signal_yes')}</span> : <span className="text-text-dim">{t('signal_no')}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right sm:pr-6">
                            <a
                              href={`${SOLSCAN}/tx/${r.signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
                            >
                              <span className="sr-only sm:not-sr-only">{t('tx_link')}</span>
                              <ExternalLink className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {data?.updated_at != null && (
            <p className="text-xs text-text-dim">{t('updated', { ago: fmtTimeAgo(data.updated_at * 1000, Date.now()) })}</p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, note, value }: { label: string; note: string; value: string | null }) {
  return (
    <div className="ring-hair rounded-xl bg-bg-card p-5">
      <p className="label">{label}</p>
      <p className="num-display mt-1 text-xl font-semibold sm:text-3xl">{value ?? <span className="skeleton inline-block h-8 w-20 rounded" />}</p>
      <p className="mt-1 text-xs text-text-dim">{note}</p>
    </div>
  );
}

function SplitRow({ label, pct, note }: { label: string; pct: number; note?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="num-display font-semibold">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-white/[0.08]">
        <div className="h-full rounded-pill bg-accent/60" style={{ width: `${pct}%` }} />
      </div>
      {note && <p className="mt-1 text-xs text-text-dim">{note}</p>}
    </div>
  );
}
