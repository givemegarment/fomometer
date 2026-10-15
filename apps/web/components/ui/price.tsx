import { fmtUSD, priceParts } from '@/lib/format';

/**
 * USD price. Below $0.001 the leading zeros collapse into a subscript count, the way
 * DexScreener prints memecoin prices: $0.00008128 → $0.0₄8128.
 */
export function Price({ value, className }: { value: number | null | undefined; className?: string }) {
  const parts = priceParts(value);
  if (!parts) return <span className={className}>{fmtUSD(value)}</span>;
  return (
    <span className={className} title={fmtUSD(value)}>
      $0.0<sub className="text-[0.75em]">{parts.zeros}</sub>
      {parts.digits}
    </span>
  );
}
