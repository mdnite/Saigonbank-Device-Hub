import { describe, expect, it } from 'vitest';
import type { AuditDetail } from '../../domain/audit';
import { buildAuditReportContent } from './generateAuditReport';

const detail = (over: Partial<AuditDetail> = {}): AuditDetail =>
  ({
    id: 3,
    status: 'Đã duyệt',
    unitName: 'Kho',
    dueDate: '2026-10-31T00:00:00.000Z',
    purpose: 'Định kỳ',
    deviceTypeName: 'Laptop',
    location: null,
    createdBy: { id: 5, fullName: 'CTV Kế toán' },
    decidedBy: { id: 6, fullName: 'TP Kế toán' },
    members: [{ id: 7, fullName: 'Nguyễn Văn A', username: 'a' }],
    items: [
      {
        deviceCode: 'LT-000001',
        deviceName: 'Dell',
        holderName: null,
        result: 'Thiếu',
        note: 'không thấy',
        accessories: [{ accessoryCode: 'SAC-01', accessoryName: 'Sạc', result: 'Đủ', note: null }],
      },
    ],
    ...over,
  }) as unknown as AuditDetail;

describe('buildAuditReportContent', () => {
  it('tiêu đề, thông tin đợt, thành viên, máy + linh kiện + kết quả, tổng', () => {
    const lines = buildAuditReportContent(detail());
    expect(lines[0]).toBe('BIÊN BẢN KIỂM KÊ THIẾT BỊ');
    expect(lines).toContain('Đơn vị kiểm kê: Kho');
    expect(lines).toContain('Đến ngày: 31/10/2026');
    expect(lines).toContain('Loại thiết bị: Laptop');
    expect(lines).toContain('Người duyệt: TP Kế toán');
    expect(lines).toContain('Thành viên tham gia: Nguyễn Văn A');
    expect(lines).toContain('- LT-000001 · Dell · Kho · Thiếu (không thấy)');
    expect(lines).toContain('    + SAC-01 · Sạc · Đủ');
    expect(lines).toContain('Tổng thiết bị: Đủ 0 · Thiếu 1 · Hỏng 0 · Chưa đếm 0');
  });

  it('chưa duyệt: không ghi người duyệt; không vị trí thì bỏ dòng vị trí', () => {
    const lines = buildAuditReportContent(detail({ status: 'Đang kiểm kê', decidedBy: { id: 6, fullName: 'TP' } }));
    expect(lines).toContain('Người duyệt: ');
    expect(lines.some((l) => l.startsWith('Vị trí'))).toBe(false);
  });
});
