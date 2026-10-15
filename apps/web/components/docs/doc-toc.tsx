'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Item = { id: string; title: string };

/** Section currently nearest the top of the viewport (for the TOC highlight). */
function useActive(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids]);
  return active;
}

/** Sticky numbered table of contents (desktop) and a swipeable chip row (mobile). */
export function DocToc({ items, label }: { items: Item[]; label: string }) {
  const active = useActive(items.map((i) => i.id));
  return (
    <>
      <nav aria-label={label} className="sticky top-6 hidden self-start lg:block">
        <p className="label mb-3">{label}</p>
        <ol className="space-y-1 border-l border-border">
          {items.map((it, i) => (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                aria-current={active === it.id ? 'location' : undefined}
                className={cn(
                  '-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors duration-150 ease-snap',
                  active === it.id ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
                )}
              >
                <span className="num-display mr-2 text-text-dim">{String(i + 1).padStart(2, '0')}</span>
                {it.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <nav aria-label={label} className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:hidden">
        {items.map((it) => (
          <a key={it.id} href={`#${it.id}`} className="ring-hair shrink-0 whitespace-nowrap rounded-pill px-3.5 py-1.5 text-[13px] text-text-muted">
            {it.title}
          </a>
        ))}
      </nav>
    </>
  );
}
