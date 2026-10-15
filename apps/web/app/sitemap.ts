import type { MetadataRoute } from 'next';

const BASE = process.env.PUBLIC_APP_URL || 'https://fomometer.xyz';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/how-it-works', '/whitepaper', '/roadmap', '/dashboard', '/dashboard/signals', '/dashboard/strategy', '/dashboard/treasury', '/terms', '/privacy'];
  return pages.map((p) => ({ url: `${BASE}${p}`, changeFrequency: p ? 'hourly' : 'daily' }));
}
