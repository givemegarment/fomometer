import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap'
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap'
});

export const viewport: Viewport = {
  themeColor: '#141415',
  width: 'device-width',
  initialScale: 1
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing');
  return {
    metadataBase: new URL(process.env.PUBLIC_APP_URL || 'https://fomometer.xyz'),
    title: { default: t('meta_title'), template: '%s · FOMOMETER' },
    description: t('meta_description'),
    applicationName: 'FOMOMETER',
    openGraph: {
      type: 'website',
      siteName: 'FOMOMETER',
      title: t('meta_title'),
      description: t('meta_description'),
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'FOMOMETER' }]
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta_title'),
      description: t('meta_description'),
      images: ['/og.png']
    },
    robots: { index: true, follow: true }
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${mono.variable} dark`}>
      <body className="min-h-screen bg-bg-base text-text-primary antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
