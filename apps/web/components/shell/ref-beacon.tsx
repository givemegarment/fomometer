'use client';

import { useEffect } from 'react';
import { isRefSource } from '@/lib/ref';

/** Counts a visit that arrived through a `?ref=` link (once per tab), then forgets it. */
export function RefBeacon() {
  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get('ref');
    if (!isRefSource(src)) return;
    try {
      if (sessionStorage.getItem('ref-counted')) return;
      sessionStorage.setItem('ref-counted', '1');
    } catch {
      /* storage blocked: count anyway */
    }
    navigator.sendBeacon?.('/api/ref', src);
  }, []);
  return null;
}
