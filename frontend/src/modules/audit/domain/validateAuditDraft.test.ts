import { describe, expect, it } from 'vitest';
import {
  emptyAuditDraft,
  emptySummaryDraft,
  hasErrors,
  validateAuditDraft,
  validateSummaryDraft,
} from './validateAuditDraft';

describe('validateAuditDraft', () => {
  it('draft rỗng: báo đơn vị, ngày, mục đích', () => {
    expect(validateAuditDraft(emptyAuditDraft())).toEqual({
      unit: 'Vui lòng chọn đơn vị được kiểm kê',
      dueDate: 'Vui lòng chọn ngày',
      purpose: 'Vui lòng chọn mục đích',
    });
  });
  it('đủ 3 ô bắt buộc (Kho): hợp lệ, loại / vị trí / thành viên tuỳ chọn', () => {
    const e = validateAuditDraft({ ...emptyAuditDraft(), unit: 'KHO', dueDate: '2026-10-31', purpose: 'Định kỳ' });
    expect(hasErrors(e)).toBe(false);
  });
});

describe('validateSummaryDraft', () => {
  it('thiếu tiêu đề (chỉ khoảng trắng) và chưa chọn đợt', () => {
    expect(validateSummaryDraft({ ...emptySummaryDraft(), title: '   ' })).toEqual({
      title: 'Vui lòng nhập tiêu đề',
      auditIds: 'Vui lòng chọn ít nhất 1 đợt kiểm kê',
    });
  });
});
