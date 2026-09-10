import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface TabItem {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
}

export function Tabs({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-6 border-b border-line', className)} role="tablist">
      {items.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition',
              selected
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.badge != null && (
              <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold leading-4 text-white">
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
