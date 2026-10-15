/**
 * StackVM operators — TypeScript port of AlphaGPT's `model_core/ops.py`.
 *
 * Original ops worked on per-batch 2D tensors (B, T). Here we operate on a
 * **single token's recent factor vector** for *one* timestep, plus optional
 * lagged values for DELAY/MAX3/DECAY which we look up in the window.
 *
 * Each op takes Numbers and returns a Number; the VM is responsible for
 * arity, stack ordering and sanitization.
 */

export type OpKey =
  | 'ADD'
  | 'SUB'
  | 'MUL'
  | 'DIV'
  | 'NEG'
  | 'ABS'
  | 'SIGN'
  | 'GATE'
  | 'JUMP'
  | 'DECAY'
  | 'DELAY1'
  | 'MAX3';

export type Op = {
  key: OpKey;
  arity: 1 | 2 | 3;
  description: string;
};

export const OPS: ReadonlyArray<Op> = [
  { key: 'ADD', arity: 2, description: 'a + b' },
  { key: 'SUB', arity: 2, description: 'a - b' },
  { key: 'MUL', arity: 2, description: 'a * b' },
  { key: 'DIV', arity: 2, description: 'a / b (epsilon-safe)' },
  { key: 'NEG', arity: 1, description: '-a' },
  { key: 'ABS', arity: 1, description: '|a|' },
  { key: 'SIGN', arity: 1, description: 'sign(a) ∈ {-1,0,1}' },
  { key: 'GATE', arity: 3, description: 'cond>0 ? x : y' },
  { key: 'JUMP', arity: 1, description: 'relu(zscore(a) - 3) — outlier flag' },
  { key: 'DECAY', arity: 1, description: 'a + 0.8·a[t-1] + 0.6·a[t-2]' },
  { key: 'DELAY1', arity: 1, description: 'a[t-1]' },
  { key: 'MAX3', arity: 1, description: 'max(a, a[t-1], a[t-2])' }
];

const EPS = 1e-6;

/**
 * Stateful op executor — keeps a small per-stack-slot history so DELAY/DECAY/MAX3 can lag.
 *
 * For our use case (single timestep evaluation per token), we approximate
 * lagged ops by reading from a **factor history** the VM provides at construction.
 */
export type OpContext = {
  /**
   * Lookup function: given the *current* feature index from the formula and
   * a lag t (>=1), return that feature's previous value, or 0 if unavailable.
   */
  lag: (featureIndex: number, t: number) => number;
  /**
   * Statistics for JUMP/normalization: mean and std of the population of the
   * given feature across the rolling window of all tracked tokens. Falls back
   * to (0, 1) when stats are unknown.
   */
  stats?: (featureIndex: number) => { mean: number; std: number };
};

const fmIndex = Symbol('feature-source-index');

/** Tagged scalar that remembers which feature index produced it (for DELAY/MAX3/DECAY). */
export type Tagged = number & { readonly [fmIndex]?: number };

export function tag(n: number, idx?: number): Tagged {
  if (idx == null) return n as Tagged;
  const o = Object.assign(Object(n), { [fmIndex]: idx });
  // Coerce to primitive number when used arithmetically; only the symbol survives reads.
  return new Number(n) as unknown as Tagged & { [fmIndex]: number };
}

export function getTag(n: Tagged | number | null | undefined): number | null {
  if (typeof n === 'object' && n !== null && fmIndex in (n as Record<symbol, unknown>)) {
    return (n as Record<symbol, number>)[fmIndex] ?? null;
  }
  return null;
}

function asNum(x: unknown): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function applyOp(
  op: OpKey,
  args: ReadonlyArray<number | Tagged>,
  ctx?: OpContext
): number {
  switch (op) {
    case 'ADD':
      return asNum(args[0]) + asNum(args[1]);
    case 'SUB':
      return asNum(args[0]) - asNum(args[1]);
    case 'MUL':
      return asNum(args[0]) * asNum(args[1]);
    case 'DIV': {
      const a = asNum(args[0]);
      const b = asNum(args[1]);
      return a / (b + (b >= 0 ? EPS : -EPS));
    }
    case 'NEG':
      return -asNum(args[0]);
    case 'ABS':
      return Math.abs(asNum(args[0]));
    case 'SIGN': {
      const v = asNum(args[0]);
      return v > 0 ? 1 : v < 0 ? -1 : 0;
    }
    case 'GATE': {
      const cond = asNum(args[0]);
      const x = asNum(args[1]);
      const y = asNum(args[2]);
      return cond > 0 ? x : y;
    }
    case 'JUMP': {
      const v = asNum(args[0]);
      const idx = getTag(args[0] as Tagged);
      const stats = idx != null && ctx?.stats ? ctx.stats(idx) : { mean: 0, std: 1 };
      const z = (v - stats.mean) / (stats.std + EPS);
      return Math.max(0, z - 3);
    }
    case 'DECAY': {
      const idx = getTag(args[0] as Tagged);
      const v0 = asNum(args[0]);
      if (idx == null || !ctx) return v0; // no lag info → identity
      const v1 = ctx.lag(idx, 1);
      const v2 = ctx.lag(idx, 2);
      return v0 + 0.8 * v1 + 0.6 * v2;
    }
    case 'DELAY1': {
      const idx = getTag(args[0] as Tagged);
      if (idx == null || !ctx) return 0; // no lag info → 0
      return ctx.lag(idx, 1);
    }
    case 'MAX3': {
      const idx = getTag(args[0] as Tagged);
      const v0 = asNum(args[0]);
      if (idx == null || !ctx) return v0;
      const v1 = ctx.lag(idx, 1);
      const v2 = ctx.lag(idx, 2);
      return Math.max(v0, v1, v2);
    }
  }
}

export const OP_BY_KEY: Record<OpKey, Op> = OPS.reduce(
  (acc, op) => {
    acc[op.key] = op;
    return acc;
  },
  {} as Record<OpKey, Op>
);
