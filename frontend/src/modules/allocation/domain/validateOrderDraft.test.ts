import { expect, it } from 'vitest';
import { emptyOrderDraft, hasErrors, validateOrderDraft } from './validateOrderDraft';

it('trống hoàn toàn: thiếu cả 3 trường bắt buộc', () => {
  const errors = validateOrderDraft(emptyOrderDraft());
  expect(errors.type).toBeDefined();
  expect(errors.targetUserId).toBeDefined();
  expect(errors.deviceIds).toBeDefined();
});

it('đủ 3 trường: không lỗi', () => {
  const errors = validateOrderDraft({ type: 'Cấp phát', targetUserId: 1, deviceIds: [1], note: '' });
  expect(hasErrors(errors)).toBe(false);
});

it('thiếu deviceIds: chỉ báo lỗi deviceIds', () => {
  const errors = validateOrderDraft({ type: 'Cấp phát', targetUserId: 1, deviceIds: [], note: '' });
  expect(hasErrors(errors)).toBe(true);
  expect(errors.deviceIds).toBeDefined();
  expect(errors.type).toBeUndefined();
  expect(errors.targetUserId).toBeUndefined();
});
