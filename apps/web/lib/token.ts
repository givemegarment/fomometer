/**
 * $FMTR, the project's X account and its source code. Every token link on the site (header, dashboard, hero, footer,
 * roadmap, whitepaper) is hidden while TOKEN_MINT is empty; filling it in at launch shows them all.
 */
export const TOKEN_SYMBOL = 'FMTR';
export const TOKEN_MINT: string = '8rAhJEyM72smDNgGUcPETXoVi21x7k2R8u2AMXGQpump';
/** The token's pump.fun page. */
export const TOKEN_URL: string = TOKEN_MINT ? `https://pump.fun/coin/${TOKEN_MINT}` : '';
export const TOKEN_LAUNCHED = TOKEN_MINT !== '' && TOKEN_URL !== '';

export const X_URL = 'https://x.com/Fomometerxyz';
export const X_HANDLE = '@Fomometerxyz';
export const REPO_URL = 'https://github.com/givemegarment/fomometer';
