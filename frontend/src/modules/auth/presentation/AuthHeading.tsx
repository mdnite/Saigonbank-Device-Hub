import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/** Icon + title block shared by the non-login auth screens. */
export function AuthHeading({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-8 flex items-center gap-3', className)}>
      {icon && <span className="text-ink-muted">{icon}</span>}
      <h1 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
        {children}
      </h1>
    </div>
  );
}
