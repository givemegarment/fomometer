/**
 * Number / currency formatters tuned for crypto dashboard.
 * Locale-aware (Intl) where it matters; numeric routines are locale-neutral.
 */

const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2
});

export function fmtUSD(n: number | null | undefined, opts?: { compact?: boolean }): string {
  if (n == null || !Number.isFinite(n)) return '·';
  if (opts?.compact) return '$' + COMPACT.format(n);
  if (n >= 1) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  }
  // For tiny memecoin prices, dynamic precision
  const digits = n === 0 ? 2 : Math.max(2, Math.min(10, Math.ceil(-Math.log10(Math.abs(n))) + 4));
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 2 });
}

export function fmtPct(n: number | null | undefined, opts?: { sign?: boolean; digits?: number }): string {
  if (n == null || !Number.isFinite(n)) return '·';
  const digits = opts?.digits ?? 2;
  const v = n.toFixed(digits);
  if (opts?.sign && n > 0) return `+${v}%`;
  return `${v}%`;
}

export function fmtTimeAgo(tsMs: number, now = Date.now()): string {
  const diff = Math.max(0, now - tsMs);
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return 'just now';
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export function shortenAddress(addr: string, head = 4, tail = 4): string {
  if (!addr || addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

/** Color helper for percent change. */
export function pctTone(n: number | null | undefined): 'up' | 'down' | 'flat' {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 0.01) return 'flat';
  return n > 0 ? 'up' : 'down';
}

/**
 * Parts of a tiny USD price in DexScreener notation: $0.00008128 → { zeros: 4, digits: '8128' },
 * rendered as $0.0₄8128. Null when the price is not tiny (0.001 and above) or not a positive number.
 */
export function priceParts(value: number | null | undefined): { zeros: number; digits: string } | null {
  if (value == null || !Number.isFinite(value) || value <= 0 || value >= 0.001) return null;
  // Round to 4 significant digits from the exponent (toFixed would expose binary error:
  // 0.00008128 prints as 0.0000812799...). Rounding up can carry into the next power.
  let exp = Math.floor(Math.log10(value));
  let sig = Math.round(value * 10 ** (3 - exp));
  if (sig >= 10000) {
    sig = Math.round(sig / 10);
    exp += 1;
  }
  if (exp >= -3) return null;
  return { zeros: -exp - 1, digits: String(sig).replace(/0+$/, '') || '0' };
}

/** 5-minute volume pace relative to the hour: raw burst factor + 1. The engine clamps the factor at 5. */
export function fmtPace(raw: number | null | undefined): string {
  if (raw == null || !Number.isFinite(raw)) return '·';
  return raw >= 5 ? '6×+' : `${Math.max(0, raw + 1).toFixed(1)}×`;
}
