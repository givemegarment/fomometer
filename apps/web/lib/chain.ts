/**
 * On-chain signal record (workers/labeler/src/record.ts). The record wallet writes every fresh
 * signal to Solana as a memo. Empty until the recording is started; the methodology section and
 * the wallet link appear only once it is set.
 */
export const CHAIN_RECORD_ADDRESS: string = 'E5D5tvhWVrZc8EFVt5xDBmRqjq6B7kuVEwcdY7XGGcDo';
export const CHAIN_RECORD_ON = CHAIN_RECORD_ADDRESS !== '';
export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`;
export const solscanAccount = (address: string) => `https://solscan.io/account/${address}`;
