import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info';

const TONES: Record<BadgeTone, string> = {
  ok: 'bg-status-okBg text-status-okFg',
  warn: 'bg-status-warnBg text-status-warnFg',
  danger: 'bg-status-dangerBg text-status-dangerFg',
  neutral: 'bg-status-neutralBg text-status-neutralFg',
  info: 'bg-card-blue text-brand',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
