import { forwardRef } from 'react';
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/shared/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn('field-base', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn('field-base resize-y', className)} {...rest} />;
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, placeholder, options, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cn('field-base appearance-none pr-9 bg-select-caret', className)} {...rest}>
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string }
>(function Checkbox({ className, label, id, ...rest }, ref) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          'h-4 w-4 rounded border-line text-brand focus:ring-brand/30',
          className,
        )}
        {...rest}
      />
      {label}
    </label>
  );
});

export const Radio = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string }
>(function Radio({ className, label, id, ...rest }, ref) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        ref={ref}
        id={id}
        type="radio"
        className={cn('h-4 w-4 border-line text-brand focus:ring-brand/30', className)}
        {...rest}
      />
      {label}
    </label>
  );
});
