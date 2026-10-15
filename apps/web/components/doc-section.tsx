import { Badge } from '@/components/ui/badge';

/** Titled section for long-form pages; the anchor target of the table of contents. */
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
    <section id={id} className="scroll-mt-24" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`${id}-title`} className="text-display-md">
          {title}
        </h2>
        {badge && <Badge>{badge}</Badge>}
      </div>
      <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-white/80">{children}</div>
    </section>
  );
}

/** Rounded, horizontally scrollable table wrapper. */
export function DocTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="ring-hair relative overflow-x-auto rounded-xl bg-bg-card">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

/** Card for a named item inside a doc section (principles, risks, signal rules). */
export function DocCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ring-hair rounded-xl bg-bg-card p-5">
      <p className="font-semibold text-text-primary">{title}</p>
      <div className="mt-1.5 text-[15px] leading-relaxed text-text-muted">{children}</div>
    </div>
  );
}
