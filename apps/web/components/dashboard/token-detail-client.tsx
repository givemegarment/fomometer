'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ExternalLink, Star } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScorePill } from '@/components/dashboard/score-pill';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS, SWR_INTERVALS } from '@/lib/swr-keys';
import { fmtPct, fmtUSD, pctTone, fmtTimeAgo, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useWatchlist } from '@/lib/watchlist';
import { FACTORS } from '@/lib/factors';

const RADAR_CLAMP = 3;


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
  events: Array<{ time: number; event_type: 'buy_trigger' | 'sell_trigger' | 'fomo_spike'; score: number; prev_score: number | null }>;
};

export function TokenDetailClient({ address }: { address: string }) {
  const t = useTranslations('token_detail');
  const tSig = useTranslations('signals');
  const tf = useTranslations('factors');
  const locale = useLocale();
  const { data, isLoading } = useSWR<TokenDetail>(SWR_KEYS.token(address), fetcher, {
    refreshInterval: SWR_INTERVALS.token
  });

  const watchlist = useWatchlist();
  const isWatched = watchlist.has(address);

  const tone = pctTone(data?.token.price_change_h24 ?? null);
  const lastScore = data?.history?.[data.history.length - 1]?.score ?? null;

  // Factors are cross-sectional z-scores (can be negative). Shift into 0..2*RADAR_CLAMP
  // so the centre is -RADAR_CLAMP and the middle ring is 0.
  const radarData = (data?.factors ?? new Array(12).fill(0)).map((v, i) => ({
    factor: FACTORS[i] ? tf(`${FACTORS[i].key}.short`) : '',
    value: (typeof v === 'number' && Number.isFinite(v) ? Math.max(-RADAR_CLAMP, Math.min(RADAR_CLAMP, v)) : 0) + RADAR_CLAMP
  }));

  const priceData = (data?.history ?? []).map((p) => ({
    t: p.time * 1000,
    price: p.price,
    score: p.score ?? null
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {t('back')}
        </Link>
        {data?.token && (
          <Button
            variant={isWatched ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => watchlist.toggle(address)}
          >
            <Star className={cn('h-4 w-4', isWatched && 'fill-warning text-warning')} />
            {isWatched ? t('unwatch') : t('watch')}
          </Button>
        )}
      </div>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-6">
          <div className="flex items-center gap-4">
            <TokenAvatar src={data?.token.image_url} symbol={data?.token.symbol ?? ''} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{data?.token.symbol ?? '·'}</h1>
                {lastScore != null && <ScorePill score={lastScore} />}
              </div>
              <div className="text-xs text-text-muted">{data?.token.name ?? ''}</div>
              <div className="mt-1 font-mono text-[11px] text-text-dim">{shortenAddress(address, 6, 6)}</div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-6">
            <div>
              <div className="text-xs text-text-muted">{t('stat_price')}</div>
              <div className="num-display text-2xl font-semibold">{fmtUSD(data?.token.price_usd)}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">{t('stat_24h')}</div>
              <div
                className={cn(
                  'num-display text-2xl font-semibold',
                  tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-text-primary'
                )}
              >
                {fmtPct(data?.token.price_change_h24 ?? null, { sign: true })}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted">{t('stat_liquidity')}</div>
              <div className="num-display text-2xl font-semibold">{fmtUSD(data?.token.liquidity_usd ?? null, { compact: true })}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">{t('stat_fdv')}</div>
              <div className="num-display text-2xl font-semibold">{fmtUSD(data?.token.fdv ?? null, { compact: true })}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two columns: chart | radar + events */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('price_chart')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72" />
            ) : priceData.length < 2 ? (
              <div className="flex h-72 items-center justify-center text-sm text-text-muted">{t('no_price')}</div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="g-price" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#AB9FF2" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#AB9FF2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#26282E" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="t"
                      tick={{ fill: '#8A8D94', fontSize: 11 }}
                      tickFormatter={(v) => new Date(v).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      stroke="#26282E"
                    />
                    <YAxis
                      domain={[(min: number) => min * 0.98, (max: number) => max * 1.02]}
                      tick={{ fill: '#8A8D94', fontSize: 11 }}
                      tickFormatter={(v: number) => '$' + v.toLocaleString('en-US', { maximumSignificantDigits: 3 })}
                      stroke="#26282E"
                      width={84}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#15161A',
                        border: '1px solid #26282E',
                        borderRadius: 12,
                        color: '#F4F4F5',
                        fontSize: 12
                      }}
                      labelFormatter={(v) => new Date(v as number).toLocaleString(locale)}
                      formatter={(value: number) => fmtUSD(value)}
                    />
                    <Area type="monotone" dataKey="price" stroke="#AB9FF2" strokeWidth={2} fill="url(#g-price)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('factor_radar')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="62%">
                  <PolarGrid stroke="#26282E" />
                  <PolarRadiusAxis domain={[0, RADAR_CLAMP * 2]} tick={false} axisLine={false} />
                  <PolarAngleAxis dataKey="factor" tick={{ fill: '#8A8D94', fontSize: 10 }} />
                  <Radar dataKey="value" stroke="#AB9FF2" fill="#AB9FF2" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events */}
      <Card>
        <CardHeader>
          <CardTitle>{t('signal_events')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.events || data.events.length === 0 ? (
            <div className="py-6 text-center text-sm text-text-muted">{t('no_events')}</div>
          ) : (
            <ul className="divide-y divide-border">
              {data.events.slice(0, 20).map((e, i) => {
                const variant =
                  e.event_type === 'buy_trigger' ? 'success' : e.event_type === 'sell_trigger' ? 'danger' : 'warning';
                const label =
                  e.event_type === 'buy_trigger'
                    ? tSig('type_buy')
                    : e.event_type === 'sell_trigger'
                      ? tSig('type_sell')
                      : tSig('type_fomo');
                return (
                  <li key={i} className="flex items-center gap-4 py-3 text-sm">
                    <Badge variant={variant}>{label}</Badge>
                    <span className="text-text-muted">{fmtTimeAgo(e.time * 1000, Date.now())}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="sr-only">{t('prev_score')}</span>
                      <ScorePill score={e.prev_score} />
                      <span className="text-text-muted" aria-hidden>→</span>
                      <ScorePill score={e.score} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* External links */}
      <Card>
        <CardHeader>
          <CardTitle>{t('links')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <a href={`https://dexscreener.com/solana/${address}`} target="_blank" rel="noopener noreferrer">
                DexScreener
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`https://birdeye.so/token/${address}?chain=solana`} target="_blank" rel="noopener noreferrer">
                Birdeye
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`https://solscan.io/token/${address}`} target="_blank" rel="noopener noreferrer">
                Solscan
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
