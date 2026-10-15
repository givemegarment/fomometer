/**
 * Shared pieces of the share cards (/api/card/*): 1200×675 PNGs for X posts, drawn by next/og
 * (Satori) from live data. Satori lays out with flexbox only: every element with more than one
 * child sets display: flex.
 */
import { priceParts } from '@/lib/format';

export const CARD = { width: 1200, height: 675 } as const;

export const C = {
  bg: '#141415',
  panel: '#1B1B1D',
  line: '#2A2A2E',
  text: '#FFFFFF',
  muted: '#A1A4AA',
  dim: '#6E7178',
  green: '#00B24B',
  red: '#F04438',
  amber: '#F5B544'
} as const;

/** Inter from /public/fonts (Satori reads TTF, not woff2). */
export async function cardFonts(origin: string) {
  const load = (f: string) => fetch(new URL(`/fonts/${f}`, origin)).then((r) => r.arrayBuffer());
  const [regular, bold] = await Promise.all([load('Inter-Regular.ttf'), load('Inter-Bold.ttf')]);
  return [
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const }
  ];
}

/** DexScreener CMS logo as a PNG or JPEG data URL (Satori cannot draw webp), or null. */
export async function logoDataUrl(src: string | null): Promise<string | null> {
  if (!src) return null;
  try {
    const u = new URL(src);
    const m = u.hostname === 'cdn.dexscreener.com' ? /^\/cms\/images\/([A-Za-z0-9_-]{6,64})$/.exec(u.pathname) : null;
    if (!m) return null;
    const r = await fetch(`https://cdn.dexscreener.com/cms/images/${m[1]}?width=128&height=128&quality=90&format=png`);
    // Asked for PNG, the CDN sometimes answers JPEG; both are fine for Satori.
    const type = (r.headers.get('content-type') ?? '').split(';')[0]!.trim();
    if (!r.ok || (type !== 'image/png' && type !== 'image/jpeg')) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(s)}`;
  } catch {
    return null;
  }
}

export const fmtSignedPct = (x: number | null | undefined, digits = 1) =>
  x == null || !Number.isFinite(x) ? '·' : `${x > 0 ? '+' : ''}${x.toFixed(digits)}%`;

export const toneOf = (x: number | null | undefined) => (x == null ? C.muted : x > 0 ? C.green : x < 0 ? C.red : C.muted);

export const fmtUtc = (unix: number) => {
  const d = new Date(unix * 1000);
  const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${d.getUTCDate()} ${mon} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
};

/** Compact dollars: $63.4K, $1.2M. */
export function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '·';
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Price in DexScreener notation: $0.0₄232 for tiny prices, as on the site. */
export function Price({ value, size }: { value: number | null; size: number }) {
  const p = priceParts(value);
  if (value == null) return <span style={{ fontSize: size }}>·</span>;
  if (!p) {
    const s = value >= 1 ? value.toFixed(4) : value.toPrecision(4);
    return <span style={{ fontSize: size }}>${String(Number(s))}</span>;
  }
  return (
    <span style={{ display: 'flex', alignItems: 'flex-end', fontSize: size }}>
      $0.0
      <span style={{ fontSize: size * 0.6, marginBottom: size * -0.08 }}>{p.zeros}</span>
      {p.digits}
    </span>
  );
}

/** Brand mark: three bars and the wordmark, as in the site header. */
export function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
      <svg width="28" height="24" viewBox="0 0 14 12">
        <rect x="0" y="7" width="3" height="5" rx="0.5" fill="#3A3A3F" />
        <rect x="5.5" y="4" width="3" height="8" rx="0.5" fill="#8A8E95" />
        <rect x="11" y="0" width="3" height="12" rx="0.5" fill={C.green} />
      </svg>
      FOMOMETER
    </div>
  );
}

/** Line chart of prices; optional dashed level (entry) and dot on the first point. */
export function Spark({
  points,
  width,
  height,
  color,
  level,
  markFirst
}: {
  points: number[];
  width: number;
  height: number;
  color: string;
  level?: number;
  markFirst?: boolean;
}) {
  const ys = level != null ? [...points, level] : points;
  if (points.length < 2) return <div style={{ display: 'flex', width, height }} />;
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || hi || 1;
  const pad = 8;
  const x = (i: number) => pad + (i / (points.length - 1)) * (width - 2 * pad);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - 2 * pad);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = points[points.length - 1]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {level != null && <line x1={pad} x2={width - pad} y1={y(level)} y2={y(level)} stroke={C.dim} strokeWidth="2" strokeDasharray="8 8" />}
      <path d={d} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      {markFirst && <circle cx={x(0)} cy={y(points[0]!)} r="9" fill={C.text} />}
      <circle cx={x(points.length - 1)} cy={y(last)} r="9" fill={color} />
    </svg>
  );
}

/** Token logo, or its first letter on a neutral disc. */
export function Logo({ src, symbol, size }: { src: string | null; symbol: string; size: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} width={size} height={size} style={{ borderRadius: size }} alt="" />;
  }
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        borderRadius: size,
        background: C.line,
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.45,
        fontWeight: 700
      }}
    >
      {(symbol || '?').slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Page frame: brand and a right-hand label on top, a footer line at the bottom. */
export function Frame({ right, footLeft, children }: { right: string; footLeft: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: CARD.width,
        height: CARD.height,
        backgroundColor: C.bg,
        backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(0,178,75,0.16) 0%, rgba(0,178,75,0) 55%)',
        color: C.text,
        fontFamily: 'Inter',
        padding: '48px 60px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand />
        <div style={{ display: 'flex', fontSize: 24, color: C.muted }}>{right}</div>
      </div>
      <div style={{ display: 'flex', flex: 1 }}>{children}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: C.dim, borderTop: `1px solid ${C.line}`, paddingTop: 22 }}>
        <div style={{ display: 'flex' }}>{footLeft}</div>
        <div style={{ display: 'flex' }}>Signal, not advice · fomometer.xyz</div>
      </div>
    </div>
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        padding: '8px 18px',
        borderRadius: 999,
        background: `${color}22`,
        color,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 1
      }}
    >
      {label}
    </div>
  );
}

export function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', fontSize: 20, color: C.dim }}>{label}</div>
      <div style={{ display: 'flex', fontSize: 32, fontWeight: 700 }}>{children}</div>
    </div>
  );
}

export const shortSig = (sig: string) => `${sig.slice(0, 4)}…${sig.slice(-4)}`;
