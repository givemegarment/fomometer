import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./apps/web', import.meta.url)) }
  },
  test: {
    include: ['packages/**/src/**/*.test.ts', 'workers/**/src/**/*.test.ts', 'apps/web/lib/**/*.test.ts'],
    environment: 'node'
  }
});
