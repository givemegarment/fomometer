import { fmtUSD } from '@/lib/format';

/**
 * USD price. Below $0.001 the leading zeros collapse into a subscript count, the way
 * DexScreener prints memecoin prices: $0.00008128 → $0.0₄8128.
 */
export function Price({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null || !Number.isFinite(value) || value <= 0 || value >= 0.001) {
    return <span className={className}>{fmtUSD(value)}</span>;
  }
  const decimals = value.toFixed(20).split('.')[1] ?? '';
  const zeros = decimals.length - decimals.replace(/^0+/, '').length;
  const digits = decimals.slice(zeros, zeros + 4).replace(/0+$/, '') || '0';
  return (
    <span className={className} title={fmtUSD(value)}>
      $0.0<sub className="text-[0.75em]">{zeros}</sub>
      {digits}
    </span>
  );
}
