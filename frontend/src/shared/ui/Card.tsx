import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-line bg-white shadow-card', className)}
      {...rest}
    />
  );
}

export function CardSection({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('p-6', className)}>
      {(title || actions) && (
        <header className="mb-5 flex items-center justify-between">
          {title && <h3 className="text-base font-semibold text-ink">{title}</h3>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
