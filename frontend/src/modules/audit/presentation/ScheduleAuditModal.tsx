import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Input, Radio, Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { AUDIT_PURPOSES, WAREHOUSE_LABEL, WAREHOUSE_UNIT, type AuditDetail } from '../domain/audit';
import {
  emptyAuditDraft,
  hasErrors,
  validateAuditDraft,
  type AuditDraft,
  type AuditDraftErrors,
} from '../domain/validateAuditDraft';
import { AuditMemberPicker } from './AuditMemberPicker';
import { auditService } from '../infrastructure/container';

export function ScheduleAuditModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (audit: AuditDetail) => void;
}) {
  const [draft, setDraft] = useState<AuditDraft>(emptyAuditDraft);
  const [errors, setErrors] = useState<AuditDraftErrors>({});
  const { data: options } = useAsyncData(
    () =>
      open
        ? Promise.all([
            auditService.departments(),
            auditService.deviceTypes(),
            auditService.locations(),
            auditService.users(),
          ])
        : Promise.resolve(null),
    [open],
  );
  const [departments, deviceTypes, locations, users] = options ?? [[], [], [], []];
  const set = (patch: Partial<AuditDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const close = () => {
    setDraft(emptyAuditDraft());
    setErrors({});
    submit.reset();
    onClose();
  };

  const submit = useAsyncAction(async () => {
    const e = validateAuditDraft(draft);
    setErrors(e);
    if (hasErrors(e)) return;
    const created = await auditService.create(draft);
    setDraft(emptyAuditDraft());
    onCreated(created);
  });

  return (
    <Modal
      open={open}
      title="Lập lịch kiểm kê"
      onClose={close}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Hủy
          </Button>
          <Button variant="dark" disabled={submit.pending} onClick={() => void submit.run()}>
            Lập lịch
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Đơn vị kiểm kê" htmlFor="audit-unit" required error={errors.unit}>
          <Select
            id="audit-unit"
            placeholder="Chọn đơn vị"
            value={draft.unit}
            onChange={(e) => set({ unit: e.target.value })}
          >
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.departmentName}
              </option>
            ))}
            <option value={WAREHOUSE_UNIT}>{WAREHOUSE_LABEL}</option>
          </Select>
        </Field>
        <Field label="Đến ngày" htmlFor="audit-due" required error={errors.dueDate}>
          <Input
            id="audit-due"
            type="date"
            value={draft.dueDate}
            onChange={(e) => set({ dueDate: e.target.value })}
          />
        </Field>
        <Field label="Loại" required>
          <div className="flex gap-6">
            <Radio id="audit-kind-detail" name="audit-kind" label="Kiểm kê chi tiết" checked readOnly />
            {/* ponytail: Kiểm kê số lượng chưa làm (spec #4) — hiện để khớp Figma, khoá lại. */}
            <Radio id="audit-kind-quantity" name="audit-kind" label="Kiểm kê số lượng" disabled />
          </div>
        </Field>
        <Field label="Loại thiết bị" htmlFor="audit-type">
          <Select id="audit-type" value={draft.deviceTypeId} onChange={(e) => set({ deviceTypeId: e.target.value })}>
            <option value="">Tất cả</option>
            {deviceTypes.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.typeName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vị trí thiết bị" htmlFor="audit-location">
          <Select id="audit-location" value={draft.location} onChange={(e) => set({ location: e.target.value })}>
            <option value="">Tất cả</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mục đích" htmlFor="audit-purpose" required error={errors.purpose}>
          <Select
            id="audit-purpose"
            placeholder="Chọn mục đích"
            value={draft.purpose}
            onChange={(e) => set({ purpose: e.target.value })}
          >
            {AUDIT_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Thành viên tham gia">
          <AuditMemberPicker
            users={users}
            departments={departments}
            selected={draft.memberIds}
            onChange={(memberIds) => set({ memberIds })}
          />
        </Field>
        {submit.error && <p className="text-sm text-status-dangerFg">{submit.error}</p>}
      </div>
    </Modal>
  );
}
