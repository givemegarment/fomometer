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
