import { Badge } from '@/components/ui/badge';

/** Titled section for long-form public pages (whitepaper, roadmap). */
export function DocSection({
  id,
  title,
  badge,
  children
}: {
  id: string;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`${id}-title`} className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {badge && <Badge>{badge}</Badge>}
      </div>
      <div className="mt-4 space-y-4 leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

/** Bordered, horizontally scrollable table wrapper matching the method page. */
export function DocTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
