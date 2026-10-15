'use client';

/**
 * Watchlist stored in the visitor's browser (localStorage).
 * The site has no accounts, so the list lives per browser; newest first.
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'fomo_watchlist';
export const WATCHLIST_MAX = 50;

const EMPTY: string[] = [];
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    cache = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: string[]) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: keep in memory for this tab */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Sync with other tabs.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const noopSubscribe = () => () => {};

export function useWatchlist() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY);
  // false during SSR/hydration — lets callers show a skeleton instead of a false "empty".
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  function has(address: string) {
    return list.includes(address);
  }

  function toggle(address: string) {
    const current = read();
    if (current.includes(address)) {
      write(current.filter((a) => a !== address));
    } else if (current.length < WATCHLIST_MAX) {
      write([address, ...current]);
    }
  }

  return { list, ready, has, toggle };
}
