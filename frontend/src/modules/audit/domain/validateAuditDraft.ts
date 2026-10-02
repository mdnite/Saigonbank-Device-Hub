/** Dạng form của modal "Lập lịch kiểm kê" — chuỗi rỗng = chưa chọn. */
export interface AuditDraft {
  /** '' | 'KHO' (WAREHOUSE_UNIT) | id phòng ban dạng chuỗi. */
  unit: string;
  dueDate: string;
  purpose: string;
  deviceTypeId: string;
  location: string;
  memberIds: number[];
}

export const emptyAuditDraft = (): AuditDraft => ({
  unit: '',
  dueDate: '',
  purpose: '',
  deviceTypeId: '',
  location: '',
  memberIds: [],
});

export type AuditDraftErrors = Partial<Record<'unit' | 'dueDate' | 'purpose', string>>;

export function validateAuditDraft(d: AuditDraft): AuditDraftErrors {
  const e: AuditDraftErrors = {};
  if (!d.unit) e.unit = 'Vui lòng chọn đơn vị kiểm kê';
  if (!d.dueDate) e.dueDate = 'Vui lòng chọn ngày';
  if (!d.purpose) e.purpose = 'Vui lòng chọn mục đích';
  return e;
}

export interface SummaryDraft {
  title: string;
  purpose: string;
  auditIds: number[];
}

export const emptySummaryDraft = (): SummaryDraft => ({ title: '', purpose: '', auditIds: [] });

export type SummaryDraftErrors = Partial<Record<'title' | 'auditIds', string>>;

export function validateSummaryDraft(d: SummaryDraft): SummaryDraftErrors {
  const e: SummaryDraftErrors = {};
  if (!d.title.trim()) e.title = 'Vui lòng nhập tiêu đề';
  if (d.auditIds.length === 0) e.auditIds = 'Vui lòng chọn ít nhất 1 đợt kiểm kê';
  return e;
}

export const hasErrors = (e: object) => Object.keys(e).length > 0;
