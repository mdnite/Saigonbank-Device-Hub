import { ClipboardCheck } from 'lucide-react';

/** Empty state theo Figma "Chưa có kiểm kê". */
export function AuditEmptyState({ hint = 'Lập lịch kiểm kê để bắt đầu kiểm kê' }: { hint?: string }) {
  return (
    <div className="grid place-items-center py-10 text-center">
      <ClipboardCheck className="mb-3 h-10 w-10 text-ink-faint" />
      <p className="text-base font-semibold text-ink">Chưa có kiểm kê</p>
      <p className="mt-1 text-sm text-ink-muted">{hint}</p>
    </div>
  );
}
