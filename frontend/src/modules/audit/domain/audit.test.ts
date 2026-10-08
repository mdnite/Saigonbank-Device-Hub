import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTimeLocal,
  groupByType,
  isOverdue,
  matrixTotal,
  membersOfDepartment,
  tally,
  todayIso,
  type AuditItem,
  type AuditResult,
} from './audit';

const item = (over: Partial<AuditItem> = {}): AuditItem => ({
  id: 1,
  deviceId: 1,
  deviceCode: 'LT-000001',
  deviceName: 'Dell',
  serialNumber: null,
  deviceTypeName: 'Laptop',
  unit: 'Cái',
  holderName: null,
  departmentName: null,
  deviceStatus: 'Trong kho',
  result: null,
  note: null,
  accessories: [],
  ...over,
});

describe('formatDate', () => {
  it('cắt phần ngày của ISO, không đổi múi giờ', () => {
    expect(formatDate('2026-10-31T00:00:00.000Z')).toBe('31/10/2026');
    expect(formatDate('2026-01-05')).toBe('05/01/2026');
  });
});

describe('formatDateTimeLocal', () => {
  it('timestamp → ngày theo giờ máy, không cắt chuỗi UTC', () => {
    const t = new Date(2026, 9, 2, 23, 30); // giờ máy 02/10/2026 23:30
    expect(formatDateTimeLocal(t.toISOString())).toBe('02/10/2026');
  });
});

describe('todayIso', () => {
  it('ngày theo giờ máy, dạng YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 9, 2, 23, 59))).toBe('2026-10-02');
  });
});

describe('isOverdue', () => {
  const due = '2026-10-31T00:00:00.000Z';
  it('đúng hạn trong chính ngày "Đến ngày"', () => {
    expect(isOverdue({ status: 'Đang kiểm kê', dueDate: due }, '2026-10-31')).toBe(false);
  });
  it('qua hạn khi đợt còn mở', () => {
    expect(isOverdue({ status: 'Chờ duyệt', dueDate: due }, '2026-11-01')).toBe(true);
  });
  it('đợt đã duyệt / đã huỷ không bao giờ quá hạn', () => {
    expect(isOverdue({ status: 'Đã duyệt', dueDate: due }, '2027-01-01')).toBe(false);
    expect(isOverdue({ status: 'Đã hủy', dueDate: due }, '2027-01-01')).toBe(false);
  });
});

describe('tally', () => {
  it('đếm Đủ / Thiếu / Hỏng / chưa đếm', () => {
    const results: (AuditResult | null)[] = ['Đủ', 'Thiếu', 'Đủ', 'Hỏng', null];
    expect(tally(results.map((result) => ({ result, note: null })))).toEqual({
      ok: 2,
      missing: 1,
      broken: 1,
      uncounted: 1,
    });
  });
});

describe('groupByType', () => {
  it('nhóm theo loại, sắp tên loại A→Z, giữ thứ tự trong nhóm', () => {
    const groups = groupByType([
      item({ id: 1, deviceTypeName: 'Máy in' }),
      item({ id: 2, deviceTypeName: 'Laptop' }),
      item({ id: 3, deviceTypeName: 'Máy in' }),
    ]);
    expect(groups.map((g) => [g.typeName, g.items.map((i) => i.id)])).toEqual([
      ['Laptop', [2]],
      ['Máy in', [1, 3]],
    ]);
  });
});

describe('matrixTotal', () => {
  it('cộng dồn các dòng ma trận', () => {
    expect(
      matrixTotal([
        { unitName: 'Kho', deviceTypeName: 'Laptop', total: 2, ok: 1, missing: 1, broken: 0 },
        { unitName: 'Kho', deviceTypeName: 'PC', total: 3, ok: 2, missing: 0, broken: 1 },
      ]),
    ).toEqual({ total: 5, ok: 3, missing: 1, broken: 1 });
  });
});

describe('membersOfDepartment', () => {
  const u = (id: number, departmentId: number | null) => ({ id, fullName: `U${id}`, username: `u${id}`, departmentId });
  it('chỉ giữ user thuộc phòng đã chọn, bỏ user không phòng ban', () => {
    expect(membersOfDepartment([u(1, 1), u(2, 2), u(3, null), u(4, 1)], 1).map((x) => x.id)).toEqual([1, 4]);
  });
});
