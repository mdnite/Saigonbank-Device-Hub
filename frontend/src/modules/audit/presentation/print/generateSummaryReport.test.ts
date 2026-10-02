import { describe, expect, it } from 'vitest';
import type { AuditSummaryDetail } from '../../domain/audit';
import { buildSummaryReportContent } from './generateSummaryReport';

describe('buildSummaryReportContent', () => {
  it('tiêu đề, các đợt, ma trận và dòng tổng', () => {
    const lines = buildSummaryReportContent({
      id: 4,
      title: 'Quý 3',
      purpose: 'Định kỳ',
      createdAt: '2026-10-01T00:00:00.000Z',
      createdBy: { id: 5, fullName: 'CTV' },
      auditCount: 1,
      audits: [{ id: 3, unitName: 'Kho', purpose: 'Định kỳ', dueDate: '2026-09-30T00:00:00.000Z', decidedAt: null, deviceCount: 2 }],
      matrix: [{ unitName: 'Kho', deviceTypeName: 'Laptop', total: 2, ok: 1, missing: 1, broken: 0 }],
    } as AuditSummaryDetail);
    expect(lines[0]).toBe('BẢNG TỔNG HỢP KIỂM KÊ CHI TIẾT');
    expect(lines).toContain('Tiêu đề: Quý 3');
    expect(lines).toContain('- Đợt #3 · Kho · Định kỳ · đến 30/09/2026 · 2 thiết bị');
    expect(lines).toContain('- Kho · Laptop: Tổng 2 · Đủ 1 · Thiếu 1 · Hỏng 0');
    expect(lines).toContain('Tổng cộng: Tổng 2 · Đủ 1 · Thiếu 1 · Hỏng 0');
  });
});
