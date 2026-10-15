export const SWR_KEYS = {
  overview: '/api/overview',
  scanner: (filter?: string) => `/api/scanner${filter ? `?filter=${filter}` : ''}`,
  token: (addr: string) => `/api/tokens/${addr}`,
  signals: (type?: string) => `/api/signals${type ? `?type=${type}` : ''}`,
  strategy: '/api/strategy',
  status: '/api/status',
  treasury: '/api/treasury',
  watchlist: (addresses: string[]) =>
    addresses.length ? `/api/watchlist?addresses=${addresses.join(',')}` : null
} as const;

export const SWR_INTERVALS = {
  scanner: 30_000,
  signals: 15_000,
  overview: 30_000,
  token: 30_000,
  status: 30_000
} as const;
