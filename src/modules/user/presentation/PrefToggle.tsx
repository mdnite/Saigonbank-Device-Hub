import { useId } from 'react';
import { Checkbox } from '@/shared/ui/inputs';

/** A single on/off preference: checkbox + label, with an optional line explaining what it does. */
export function PrefToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Checkbox id={id} label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {description && <p className="pl-6 text-xs text-ink-muted">{description}</p>}
    </div>
  );
}
