import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Checkbox, Input, Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { AUDIT_PURPOSES, AUDIT_STATUS, formatDate, type AuditSummaryDetail } from '../domain/audit';
import {
  emptySummaryDraft,
  hasErrors,
  validateSummaryDraft,
  type SummaryDraft,
  type SummaryDraftErrors,
} from '../domain/validateAuditDraft';
import { auditService } from '../infrastructure/container';

export function CreateSummaryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (summary: AuditSummaryDetail) => void;
}) {
  const [draft, setDraft] = useState<SummaryDraft>(emptySummaryDraft);
  const [errors, setErrors] = useState<SummaryDraftErrors>({});
  const { data: approved } = useAsyncData(
    () => (open ? auditService.list({ status: AUDIT_STATUS.APPROVED }) : Promise.resolve(null)),
    [open],
  );

  const close = () => {
    setDraft(emptySummaryDraft());
    setErrors({});
    submit.reset();
    onClose();
  };
  const submit = useAsyncAction(async () => {
    const e = validateSummaryDraft(draft);
    setErrors(e);
    if (hasErrors(e)) return;
    const created = await auditService.createSummary(draft);
    setDraft(emptySummaryDraft());
    onCreated(created);
  });
  const toggle = (id: number) =>
    setDraft((d) => ({
      ...d,
      auditIds: d.auditIds.includes(id) ? d.auditIds.filter((x) => x !== id) : [...d.auditIds, id],
    }));

  return (
    <Modal
      open={open}
      title="Lập bảng tổng hợp"
      onClose={close}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Hủy
          </Button>
          <Button variant="dark" disabled={submit.pending} onClick={() => void submit.run()}>
            Lập bảng
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Tiêu đề" htmlFor="summary-title" required error={errors.title}>
          <Input
            id="summary-title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </Field>
        <Field label="Mục đích" htmlFor="summary-purpose">
          <Select
            id="summary-purpose"
            value={draft.purpose}
            onChange={(e) => setDraft((d) => ({ ...d, purpose: e.target.value }))}
          >
            <option value="">(Không ghi)</option>
            {AUDIT_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Đợt kiểm kê đã duyệt" required error={errors.auditIds}>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-3">
            {(approved ?? []).length === 0 && (
              <p className="text-sm text-ink-muted">Chưa có đợt kiểm kê nào đã duyệt</p>
            )}
            {(approved ?? []).map((a) => (
              <div key={a.id}>
                <Checkbox
                  id={`summary-audit-${a.id}`}
                  label={`#${a.id} · ${a.unitName} · ${a.purpose} · đến ${formatDate(a.dueDate)}`}
                  checked={draft.auditIds.includes(a.id)}
                  onChange={() => toggle(a.id)}
                />
              </div>
            ))}
          </div>
        </Field>
        {submit.error && <p className="text-sm text-status-dangerFg">{submit.error}</p>}
      </div>
    </Modal>
  );
}
