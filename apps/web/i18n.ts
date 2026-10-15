import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const locales = ['en', 'ru'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

function pickLocale(): Locale {
  const cookieLocale = cookies().get('LOCALE')?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }
  const accept = headers().get('accept-language') ?? '';
  const first = accept.split(',')[0]?.toLowerCase() ?? '';
  if (first.startsWith('ru')) return 'ru';
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = pickLocale();
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    timeZone: 'UTC'
  };
});
