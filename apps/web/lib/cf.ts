/**
 * Cloudflare Pages bindings access for App Router.
 * Uses `getRequestContext()` from `@cloudflare/next-on-pages` at runtime;
 * in `next dev` (local) we fall back to dev-only stubs so pages still render.
 */
import type { D1Database } from '@cloudflare/workers-types';

export type CFEnv = {
  DB: D1Database;
};

let _ctx: { env: CFEnv } | null = null;

export async function getCF(): Promise<{ env: CFEnv } | null> {
  if (_ctx) return _ctx;
  try {
    // Lazy import — only resolves on Cloudflare runtime.
    const mod = await import('@cloudflare/next-on-pages');
    if (typeof (mod as any).getRequestContext === 'function') {
      _ctx = (mod as any).getRequestContext();
      return _ctx;
    }
  } catch {
    /* not on CF runtime */
  }
  return null;
}

/** Strict variant: throws if bindings are unavailable (use inside route handlers). */
export async function requireCF(): Promise<{ env: CFEnv }> {
  const ctx = await getCF();
  if (!ctx) throw new Error('Cloudflare bindings unavailable in this runtime.');
  return ctx;
}
