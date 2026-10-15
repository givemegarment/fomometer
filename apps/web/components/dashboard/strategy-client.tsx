'use client';

import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS } from '@/lib/swr-keys';
import { cn } from '@/lib/cn';

/** Below this many priced outcomes a percentage is noise; show "not enough data". */
const MIN_SAMPLE = 20;
const HORIZONS = ['15m', '1h', '4h'] as const;

type Settings = {
  at: number | null;
  weights_trained: boolean;
  thresholds_trained: boolean;
  thresholds_adaptive: boolean;
  buy_th: number | null;
  sell_th: number | null;
  fomo_th: number | null;
  regime: 'neutral' | 'bull' | 'bear' | 'panic' | null;
  normalize_cross_sectional: boolean;
  regime_aware: boolean;
  weights: Record<string, number> | null;
};

type Horizon = { n: number; favorable: number | null; median_pct: number | null };
/** One row of the track record, as summarized hourly by the labeler. */
type Group = { n: number; flagged: number; lost_4h: number; horizons: Record<(typeof HORIZONS)[number], Horizon> };
type TrackRecord = {
  at: number;
  days: number;
  events: Record<'buy_trigger' | 'sell_trigger' | 'fomo_spike', Group>;
  baseline: Group & { first_sample: number | null };
};

type StrategyResponse = { settings: Settings | null; record: TrackRecord | null };

const TYPE_KEY = { buy_trigger: 'buy', sell_trigger: 'sell', fomo_spike: 'fomo' } as const;
const EVENT_TYPES = ['buy_trigger', 'sell_trigger', 'fomo_spike'] as const;

export function StrategyClient() {
  const t = useTranslations('strategy');
  const { data, error } = useSWR<StrategyResponse>(SWR_KEYS.strategy, fetcher, { refreshInterval: 60_000 });
  const s = data?.settings;

  return (
    <div className="space-y-6">
      <h1 className="text-display-lg">{t('title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-danger">{t('load_error')}</p>
          ) : !data ? (
            <Skeleton className="h-[184px] sm:h-[120px] lg:h-14" />
          ) : !s ? (
            <p className="text-sm text-text-muted">{t('settings_empty')}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
              <Setting label={t('buy_th')} value={s.buy_th != null ? Math.round(s.buy_th * 100).toString() : '·'} />
              <Setting label={t('sell_th')} value={s.sell_th != null ? Math.round(s.sell_th * 100).toString() : '·'} />
              <Setting label={t('fomo_th')} value={s.fomo_th != null ? s.fomo_th.toFixed(2) : '·'} />
              <Setting label={t('regime')} value={s.regime ? t(`regimes.${s.regime}`) : '·'} />
              <Setting label={t('weights')} value={s.weights_trained ? t('trained') : t('default')} />
              <Setting
                label={t('thresholds')}
                value={s.thresholds_trained ? t('trained') : s.thresholds_adaptive ? t('adaptive') : t('default')}
              />
            </dl>
          )}
        </CardContent>
      </Card>

      <WeightsCard settings={s} loaded={!!data} failed={!!error} />

      <RecordCard record={data?.record} loaded={!!data} failed={!!error} />
    </div>
  );
}

function WeightsCard({ settings, loaded, failed }: { settings: Settings | null | undefined; loaded: boolean; failed: boolean }) {
  const t = useTranslations('strategy');
  const tf = useTranslations('factors');
  const rows = Object.entries(settings?.weights ?? {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const max = Math.max(...rows.map(([, w]) => Math.abs(w)), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('weights_title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {failed ? (
          <p className="text-sm text-danger">{t('load_error')}</p>
        ) : !loaded ? (
          <Skeleton className="h-[212px]" />
        ) : !rows.length ? (
          <p className="text-sm text-text-muted">{t('weights_empty')}</p>
        ) : (
          <>
            <ul className="space-y-3">
              {rows.map(([key, w]) => (
                <li key={key} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_4rem]">
                  <span className="leading-snug" title={tf.has(`${key}.hint`) ? tf(`${key}.hint`) : undefined}>
                    {tf.has(`${key}.label`) ? tf(`${key}.label`) : key}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-bg-chip" aria-hidden="true">
                    <span
                      className={cn('block h-full rounded-full', w < 0 ? 'bg-danger' : 'bg-accent')}
                      style={{ width: `${max > 0 ? (Math.abs(w) / max) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="num-display text-right">{(w * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="num-display mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function RecordCard({ record, loaded, failed }: { record: TrackRecord | null | undefined; loaded: boolean; failed: boolean }) {
  const t = useTranslations('strategy');
  const flagged = record
    ? EVENT_TYPES.reduce((sum, k) => sum + record.events[k].flagged, 0) + record.baseline.flagged
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('record_title', { days: record?.days ?? 7 })}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {failed ? (
          <p className="px-4 pb-6 text-sm text-danger sm:px-6">{t('load_error')}</p>
        ) : !loaded ? (
          <div className="p-6">
            <Skeleton className="h-[600px] sm:h-[360px]" />
          </div>
        ) : !record ? (
          <p className="px-4 pb-6 text-sm text-text-muted sm:px-6">{t('record_empty')}</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th scope="col" className="px-4 py-3 text-left font-medium sm:px-6">{t('col_type')}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t('col_n')}</th>
                  {HORIZONS.map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 text-right font-medium">
                      {t('col_favorable', { h: t(`horizon.${h}`) })}
                    </th>
                  ))}
                  {(['1h', '4h'] as const).map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 text-right font-medium">
                      {t('col_median', { h: t(`horizon.${h}`) })}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-right font-medium sm:pr-6">{t('col_lost')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {EVENT_TYPES.map((type) => {
                  const key = TYPE_KEY[type];
                  return (
                    <RecordRow
                      key={type}
                      label={t(`types.${key}`)}
                      // Only SELL needs its rule spelled out: it wins when the price falls.
                      hint={key === 'sell' ? t('favorable.sell') : undefined}
                      group={record.events[type]}
                    />
                  );
                })}
                <RecordRow
                  label={t('baseline_label')}
                  group={record.baseline}
                  baseline
                />
              </tbody>
            </table>
          </div>
        )}
        {/* One line kept on purpose: without it the rows read better than they are. */}
        <p className="border-t border-border px-4 py-3 text-xs text-text-dim sm:px-6">{t('record_footer', { n: flagged })}</p>
      </CardContent>
    </Card>
  );
}

function RecordRow({ label, hint, group, baseline }: { label: string; hint?: string; group: Group; baseline?: boolean }) {
  const t = useTranslations('strategy');
  const fmt = new Intl.NumberFormat(useLocale()).format;
  const priced = group.n - group.flagged;
  return (
    <tr className={baseline ? 'border-t-2 border-border bg-bg-chip/40' : undefined}>
      <th scope="row" className="px-4 py-3 text-left font-medium sm:px-6">
        {label}
        {hint && <span className="block text-xs font-normal text-text-muted">{hint}</span>}
      </th>
      <td className="num-display px-4 py-3 text-right text-text-muted">{fmt(group.n)}</td>
      {group.n === 0 ? (
        <td colSpan={HORIZONS.length + 3} className="px-4 py-3 text-left text-text-muted sm:pr-6">
          {t('none_in_window')}
        </td>
      ) : (
        <>
          {HORIZONS.map((h) => {
            const v = group.horizons[h];
            return (
              <td key={h} className="num-display px-4 py-3 text-right">
                {v.n < MIN_SAMPLE || v.favorable == null ? (
                  <span className="text-text-muted">{t('not_enough')}</span>
                ) : (
                  <>
                    {(v.favorable * 100).toFixed(0)}%
                    <span className="block text-xs text-text-muted">n={fmt(v.n)}</span>
                  </>
                )}
              </td>
            );
          })}
          {(['1h', '4h'] as const).map((h) => {
            const v = group.horizons[h];
            const m = v.median_pct;
            const enough = v.n >= MIN_SAMPLE && m != null;
            return (
              <td
                key={h}
                className={cn(
                  'num-display px-4 py-3 text-right',
                  !enough ? 'text-text-muted' : m > 0 ? 'text-success' : m < 0 ? 'text-danger' : 'text-text-muted'
                )}
              >
                {!enough ? t('not_enough') : `${m > 0 ? '+' : ''}${m.toFixed(2)}%`}
              </td>
            );
          })}
          <td className="num-display px-4 py-3 text-right text-text-muted sm:pr-6">
            {priced < MIN_SAMPLE ? (
              t('not_enough')
            ) : (
              <>
                {((group.lost_4h / priced) * 100).toFixed(0)}%
                <span className="block text-xs">
                  {fmt(group.lost_4h)}/{fmt(priced)}
                </span>
              </>
            )}
          </td>
        </>
      )}
    </tr>
  );
}
