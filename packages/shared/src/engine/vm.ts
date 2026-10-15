/**
 * StackVM — TypeScript port of AlphaGPT's `model_core/vm.py`.
 *
 * Token vocabulary:
 *  - tokens [0..feat_offset)  → feature indices into the 12-dim factor vector
 *  - tokens [feat_offset..feat_offset + OPS.length) → op indices into OPS
 *
 * `feat_offset` defaults to 12 (matches our 12-factor vector). When loading a
 * formula trained against the 6-feature legacy AlphaGPT (FeatureEngineer.INPUT_DIM=6),
 * pass `featOffset: 6` to keep token alignment.
 */
import { OPS, OP_BY_KEY, applyOp, type OpContext, type Tagged, tag, getTag } from './ops';
import type { FactorVector } from '../types';

export type FormulaTokens = ReadonlyArray<number>;

export type VMConfig = {
  featOffset?: number;
};

export class StackVM {
  private readonly featOffset: number;

  constructor(cfg: VMConfig = {}) {
    this.featOffset = cfg.featOffset ?? 12;
  }

  /**
   * Execute a formula on a single factor vector for one timestep.
   * Returns null if the formula is malformed or stack underflow occurs.
   */
  execute(tokens: FormulaTokens, factors: FactorVector, ctx?: OpContext): number | null {
    const stack: Array<number | Tagged> = [];
    try {
      for (const tok of tokens) {
        if (tok < this.featOffset) {
          // Feature token
          if (tok < 0 || tok >= factors.length) return null;
          const v = factors[tok];
          stack.push(tag(typeof v === 'number' ? v : Number(v), tok));
          continue;
        }
        // Op token
        const opIdx = tok - this.featOffset;
        const op = OPS[opIdx];
        if (!op) return null;
        if (stack.length < op.arity) return null;
        const args: Array<number | Tagged> = [];
        for (let i = 0; i < op.arity; i++) args.push(stack.pop()!);
        args.reverse();
        let res = applyOp(op.key, args, ctx);
        if (!Number.isFinite(res)) res = 0;
        // Result loses tag (it's a derived value)
        stack.push(res);
      }
      if (stack.length !== 1) return null;
      const v = stack[0];
      return typeof v === 'number' ? v : Number(v);
    } catch {
      return null;
    }
  }
}

export const DEFAULT_VM = new StackVM();

/** Convenience: resolve a token to a human-readable label. */
export function tokenLabel(tok: number, featOffset = 12): string {
  if (tok < featOffset) return `f${tok}`;
  const op = OPS[tok - featOffset];
  return op ? op.key : `?${tok}`;
}

void OP_BY_KEY;
void getTag;
