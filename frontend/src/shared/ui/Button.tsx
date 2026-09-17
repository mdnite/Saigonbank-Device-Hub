import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

type Variant = 'primary' | 'soft' | 'dark' | 'outline' | 'ghost' | 'link';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand/90 shadow-sm',
  soft: 'bg-brand-soft text-white hover:bg-brand-soft/90 shadow-sm',
  dark: 'bg-ink text-white hover:bg-ink/90 shadow-sm',
  outline: 'border border-line bg-white text-ink hover:bg-surface-sunken',
  ghost: 'text-ink hover:bg-surface-sunken',
  link: 'text-brand hover:underline px-0 py-0 h-auto shadow-none',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', leadingIcon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition outline-none',
        'focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        variant !== 'link' && SIZES[size],
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
    </button>
  );
});
