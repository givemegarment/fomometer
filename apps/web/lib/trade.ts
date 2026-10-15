/**
 * Swaps run in the visitor's own wallet through the Jupiter Plugin; FOMOMETER only adds a
 * referral fee. Nothing here is secret: the referral account is public on-chain.
 */

/** Jupiter referral account that receives the fee. Empty hides every Buy button. */
export const JUP_REFERRAL_ACCOUNT = '';

/** Fee added to swaps started here, in basis points (Jupiter allows 50 to 255 and keeps 20% of it). */
export const JUP_REFERRAL_FEE_BPS = 100;

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export const TRADING_ENABLED = JUP_REFERRAL_ACCOUNT.length > 0;

/** Fee as a percent for copy, e.g. 100 bps → "1". */
export const FEE_PCT = String(JUP_REFERRAL_FEE_BPS / 100);
