import { getRequestConfig } from 'next-intl/server';

/** The site is English only. next-intl stays as the home for all UI copy (messages/en.json). */
export const locales = ['en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async () => ({
  locale: defaultLocale,
  // Template path keeps the import untyped: messages include arrays read with t.raw().
  messages: (await import(`./messages/${defaultLocale}.json`)).default,
  timeZone: 'UTC'
}));
