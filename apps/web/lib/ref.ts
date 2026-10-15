/** Link sources counted by /api/ref: `?ref=x` on links in FOMOMETER's own posts. */
export const REF_SOURCES = ['x'] as const;
export type RefSource = (typeof REF_SOURCES)[number];
export const isRefSource = (s: string | null): s is RefSource => s != null && (REF_SOURCES as readonly string[]).includes(s);
