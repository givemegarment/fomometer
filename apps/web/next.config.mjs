import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Token logos are plain <img> (no Next image optimizer on Cloudflare Pages).
  async redirects() {
    return [
      { source: '/dashboard/settings', destination: '/dashboard', permanent: true },
      // The scanner and the overview became one board at /dashboard.
      { source: '/dashboard/scanner', destination: '/dashboard', permanent: true }
    ];
  },
  experimental: {
    typedRoutes: false
  }
};

export default withNextIntl(nextConfig);
