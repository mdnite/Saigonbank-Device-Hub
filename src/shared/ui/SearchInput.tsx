import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input type="search" className={cn('field-base pl-10', className)} {...rest} />
    </div>
  );
}
