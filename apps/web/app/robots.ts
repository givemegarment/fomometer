import type { MetadataRoute } from 'next';

const BASE = process.env.PUBLIC_APP_URL || 'https://fomometer.xyz';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
    sitemap: `${BASE}/sitemap.xml`
  };
}
