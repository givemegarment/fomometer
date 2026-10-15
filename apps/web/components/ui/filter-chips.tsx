'use client';

import { cn } from '@/lib/cn';

/** Pill filter row (the reference's chip style): active chip is solid white. Scrolls on mobile. */
export function FilterChips<T extends string>({
  items,
  value,
  onChange,
  label
}: {
  items: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-1 flex max-w-full overflow-x-auto">
      {items.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-pressed={value === f.id}
          onClick={() => onChange(f.id)}
          className={cn(
            'mx-1 whitespace-nowrap rounded-pill px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ease-snap',
            value === f.id ? 'bg-white text-bg-base' : 'ring-hair text-text-muted hover:bg-white/[0.06] hover:text-text-primary'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
