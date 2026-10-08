import type { UserRef } from '@/modules/device/domain/device';

/** Trạng thái đợt — chuỗi tiếng Việt y hệt backend lưu trong DB. */
export const AUDIT_STATUS = {
  NOT_STARTED: 'Chưa kiểm kê',
  IN_PROGRESS: 'Đang kiểm kê',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  CANCELLED: 'Đã hủy',
} as const;
export type AuditStatus = (typeof AUDIT_STATUS)[keyof typeof AUDIT_STATUS];

export const OPEN_AUDIT_STATUSES: AuditStatus[] = [
  AUDIT_STATUS.NOT_STARTED,
  AUDIT_STATUS.IN_PROGRESS,
  AUDIT_STATUS.PENDING,
];

export const AUDIT_RESULT = { OK: 'Đủ', MISSING: 'Thiếu', BROKEN: 'Hỏng' } as const;
export type AuditResult = (typeof AUDIT_RESULT)[keyof typeof AUDIT_RESULT];
export const AUDIT_RESULTS: AuditResult[] = [AUDIT_RESULT.OK, AUDIT_RESULT.MISSING, AUDIT_RESULT.BROKEN];

export const AUDIT_PURPOSES = ['Định kỳ', 'Đột xuất', 'Cuối năm'] as const;

/** Giá trị ô "Đơn vị kiểm kê" cho đơn vị giả Kho — backend nhận departmentId = null. */
export const WAREHOUSE_UNIT = 'KHO';
export const WAREHOUSE_LABEL = 'Kho';

export interface DepartmentRef {
  id: number;
  departmentCode: string;
  departmentName: string;
}

export interface AuditLine {
  result: AuditResult | null;
  note: string | null;
}

export interface AuditAccessoryLine extends AuditLine {
  id: number;
  accessoryCode: string;
  accessoryName: string;
  accessoryType: string;
  unit: string;
}

export interface AuditItem extends AuditLine {
  id: number;
  deviceId: number;
  deviceCode: string;
  deviceName: string;
  serialNumber: string | null;
  deviceTypeName: string;
  unit: string;
  holderName: string | null;
  departmentName: string | null;
  deviceStatus: string;
  accessories: AuditAccessoryLine[];
}

export interface Audit {
  id: number;
  status: AuditStatus;
  departmentId: number | null;
  unitName: string;
  dueDate: string;
  purpose: string;
  deviceTypeName: string | null;
  location: string | null;
  rejectReason: string | null;
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  createdBy: { id: number; fullName: string };
  decidedBy: { id: number; fullName: string } | null;
  deviceCount: number;
  totalLines: number;
  countedLines: number;
}

export interface AuditDetail extends Audit {
  members: UserRef[];
  items: AuditItem[];
}

export interface MatrixRow {
  unitName: string;
  deviceTypeName: string;
  total: number;
  ok: number;
  missing: number;
  broken: number;
}

export interface AuditSummary {
  id: number;
  title: string;
  purpose: string | null;
  createdAt: string;
  createdBy: { id: number; fullName: string };
  auditCount: number;
}

export interface AuditSummaryDetail extends AuditSummary {
  audits: {
    id: number;
    unitName: string;
    purpose: string;
    dueDate: string;
    decidedAt: string | null;
    deviceCount: number;
  }[];
  matrix: MatrixRow[];
}

/** "2026-10-31T00:00:00.000Z" → "31/10/2026". Chỉ cắt chuỗi: cột DueDate là ngày thuần, đổi múi giờ sẽ lệch ngày. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Timestamp ("2026-10-01T17:30:00.000Z") → ngày theo giờ máy người dùng "02/10/2026". Chỉ dùng cho mốc thời gian, không dùng cho dueDate. */
export function formatDateTimeLocal(iso: string): string {
  const t = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()}`;
}

/** Hôm nay theo giờ máy người dùng, dạng YYYY-MM-DD (so được với dueDate.slice(0, 10)). */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "Quá hạn" (#18): qua "Đến ngày" mà đợt còn mở. Chỉ để hiển thị, không chặn gì. */
export function isOverdue(audit: Pick<Audit, 'status' | 'dueDate'>, today: string): boolean {
  return OPEN_AUDIT_STATUSES.includes(audit.status) && audit.dueDate.slice(0, 10) < today;
}

export interface Tally {
  ok: number;
  missing: number;
  broken: number;
  uncounted: number;
}

export function tally(lines: AuditLine[]): Tally {
  return {
    ok: lines.filter((l) => l.result === AUDIT_RESULT.OK).length,
    missing: lines.filter((l) => l.result === AUDIT_RESULT.MISSING).length,
    broken: lines.filter((l) => l.result === AUDIT_RESULT.BROKEN).length,
    uncounted: lines.filter((l) => l.result === null).length,
  };
}

export function groupByType(items: AuditItem[]): { typeName: string; items: AuditItem[] }[] {
  const groups = new Map<string, AuditItem[]>();
  for (const i of items) groups.set(i.deviceTypeName, [...(groups.get(i.deviceTypeName) ?? []), i]);
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'vi'))
    .map(([typeName, rows]) => ({ typeName, items: rows }));
}

export function matrixTotal(rows: MatrixRow[]) {
  return rows.reduce(
    (t, r) => ({
      total: t.total + r.total,
      ok: t.ok + r.ok,
      missing: t.missing + r.missing,
      broken: t.broken + r.broken,
    }),
    { total: 0, ok: 0, missing: 0, broken: 0 },
  );
}

/** 1 dòng của GET /users/lookup — có phòng ban để lọc thành viên kiểm kê. */
export interface MemberOption {
  id: number;
  fullName: string;
  username: string;
  departmentId: number | null;
}

export function membersOfDepartment(users: MemberOption[], departmentId: number): MemberOption[] {
  return users.filter((u) => u.departmentId === departmentId);
}
