import { describe, expect, it } from 'vitest';
import { fmtPace, fmtTimeAgo, priceParts } from './format';
import { logoSrc } from './logo';

describe('priceParts', () => {
  it('collapses leading zeros the DexScreener way', () => {
    expect(priceParts(0.00008128)).toEqual({ zeros: 4, digits: '8128' });
    expect(priceParts(0.0000052)).toEqual({ zeros: 5, digits: '52' });
    expect(priceParts(0.000099996)).toEqual({ zeros: 3, digits: '1' }); // rounds up to 0.0001
    expect(priceParts(1.23456e-9)).toEqual({ zeros: 8, digits: '1235' });
  });
  it('leaves normal prices and bad input to the plain formatter', () => {
    expect(priceParts(0.0012)).toBeNull();
    expect(priceParts(0)).toBeNull();
    expect(priceParts(null)).toBeNull();
  });
});

describe('fmtPace', () => {
  it('shows the raw factor + 1 as a multiple and marks the engine clamp', () => {
    expect(fmtPace(0.4)).toBe('1.4×');
    expect(fmtPace(-1)).toBe('0.0×');
    expect(fmtPace(5)).toBe('6×+');
    expect(fmtPace(null)).toBe('·');
  });
});

describe('fmtTimeAgo', () => {
  const now = 1_000_000_000_000;
  it('buckets seconds, minutes, hours and days', () => {
    expect(fmtTimeAgo(now - 10_000, now)).toBe('just now');
    expect(fmtTimeAgo(now - 45_000, now)).toBe('45 sec ago');
    expect(fmtTimeAgo(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(fmtTimeAgo(now - 3 * 3_600_000, now)).toBe('3 hr ago');
    expect(fmtTimeAgo(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
});

describe('logoSrc', () => {
  const ds = 'https://cdn.dexscreener.com/cms/images/oKyBDuIHI7W2lUnK?width=800&height=800&quality=95&format=auto';
  it('routes DexScreener CMS logos through /api/logo at an accepted size', () => {
    expect(logoSrc(ds, 28)).toBe('/api/logo/oKyBDuIHI7W2lUnK?s=64');
    expect(logoSrc(ds, 48)).toBe('/api/logo/oKyBDuIHI7W2lUnK?s=128');
    expect(logoSrc(ds, 200)).toBe('/api/logo/oKyBDuIHI7W2lUnK?s=256');
  });
  it('leaves other URLs and junk alone', () => {
    expect(logoSrc('https://example.com/a.png', 28)).toBe('https://example.com/a.png');
    expect(logoSrc('not a url', 28)).toBe('not a url');
  });
});
