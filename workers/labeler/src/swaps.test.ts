import { describe, expect, it } from 'vitest';
import { parseSwap, WSOL_MINT, type ParsedTx } from './swaps';

const REF = 'Fyhr9NJU2JbwdTL4ZZRRaCpnJH1eLydDnBZsc9khJBTA';
const WALLET = '9XTDq6feuwzRCmSV8tP4uGD1nq6LMzx9h5RaftyLKDyz';
const TOKEN = 'AMQ8BusAhpwbt3ufSCTi4k3BEQ7AecX9u12Jnk6Spump';
const POOL = 'AmJYXEpoolOwner11111111111111111111111111111';

const bal = (accountIndex: number, mint: string, owner: string, amount: string, decimals = 9) => ({
  accountIndex,
  mint,
  owner,
  uiTokenAmount: { amount, decimals }
});

/**
 * Trimmed from the first live swap through the site (2SxoQQ…, 15 October 2026):
 * 0.001 SOL into DIKSHIT, 10,000 lamports of fee to the referral account's SOL account.
 */
const firstSwap = (): ParsedTx => ({
  blockTime: 1792075640,
  transaction: {
    signatures: ['2SxoQQwqVfHcXRj9d6dLcUtuYcCqeedgsAhhQVd1xCuR1AZDoXdSBh1Y3ihqSc3KywAVdx9nGa21igav5TkLGwsq'],
    message: { accountKeys: [{ pubkey: WALLET, signer: true }, { pubkey: 'other', signer: false }] }
  },
  meta: {
    err: null,
    preTokenBalances: [bal(3, WSOL_MINT, REF, '0'), bal(13, WSOL_MINT, POOL, '182594831424'), bal(14, TOKEN, POOL, '106817857624999', 6)],
    postTokenBalances: [
      bal(3, WSOL_MINT, REF, '10000'),
      bal(4, TOKEN, WALLET, '522507723', 6),
      bal(13, WSOL_MINT, POOL, '182595821179'),
      bal(14, TOKEN, POOL, '106817335117276', 6)
    ]
  }
});

describe('parseSwap', () => {
  it('reads the first live swap as a buy with a 1% fee', () => {
    expect(parseSwap(firstSwap(), REF, 100)).toEqual({
      signature: '2SxoQQwqVfHcXRj9d6dLcUtuYcCqeedgsAhhQVd1xCuR1AZDoXdSBh1Y3ihqSc3KywAVdx9nGa21igav5TkLGwsq',
      blockTime: 1792075640,
      wallet: WALLET,
      side: 'buy',
      mint: TOKEN,
      tokenAmount: '522507723',
      feeMint: WSOL_MINT,
      feeUi: 0.00001,
      notionalUi: 0.001
    });
  });

  it('reads a sell when the wallet token account shrinks or closes', () => {
    const tx = firstSwap();
    tx.meta!.preTokenBalances = [bal(3, WSOL_MINT, REF, '0'), bal(4, TOKEN, WALLET, '522507723', 6)];
    tx.meta!.postTokenBalances = [bal(3, WSOL_MINT, REF, '9000')]; // wallet account closed
    const s = parseSwap(tx, REF, 100)!;
    expect(s.side).toBe('sell');
    expect(s.tokenAmount).toBe('522507723');
    expect(s.notionalUi).toBeCloseTo(0.0009, 12);
  });

  it('ignores transactions that paid no fee to the referral account', () => {
    const tx = firstSwap();
    tx.meta!.postTokenBalances = tx.meta!.postTokenBalances!.map((b) => (b.owner === REF ? { ...b, uiTokenAmount: { amount: '0', decimals: 9 } } : b));
    expect(parseSwap(tx, REF, 100)).toBeNull();
    expect(parseSwap(firstSwap(), 'someone-else', 100)).toBeNull();
  });

  it('ignores failed transactions and claims that lower the fee balance', () => {
    const failed = firstSwap();
    failed.meta!.err = { InstructionError: [0, 'Custom'] };
    expect(parseSwap(failed, REF, 100)).toBeNull();

    const claim = firstSwap();
    claim.meta!.preTokenBalances = [bal(3, WSOL_MINT, REF, '10000')];
    claim.meta!.postTokenBalances = [bal(3, WSOL_MINT, REF, '0')];
    expect(parseSwap(claim, REF, 100)).toBeNull();
  });
});
