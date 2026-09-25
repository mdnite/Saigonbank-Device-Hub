import { expect, it } from 'vitest';
import { emptyTransferDraft, hasErrors, validateTransferDraft } from './validateTransferDraft';

it('trống hoàn toàn: thiếu cả 3 trường bắt buộc', () => {
  const errors = validateTransferDraft(emptyTransferDraft());
  expect(errors.fromUserId).toBeDefined();
  expect(errors.toUserId).toBeDefined();
  expect(errors.deviceIds).toBeDefined();
});

it('đủ 3 trường, fromUserId khác toUserId: không lỗi', () => {
  const errors = validateTransferDraft({ fromUserId: 1, toUserId: 2, deviceIds: [1], note: '' });
  expect(hasErrors(errors)).toBe(false);
});

it('fromUserId === toUserId: báo lỗi toUserId', () => {
  const errors = validateTransferDraft({ fromUserId: 1, toUserId: 1, deviceIds: [1], note: '' });
  expect(hasErrors(errors)).toBe(true);
  expect(errors.toUserId).toBeDefined();
});

it('thiếu deviceIds: chỉ báo lỗi deviceIds', () => {
  const errors = validateTransferDraft({ fromUserId: 1, toUserId: 2, deviceIds: [], note: '' });
  expect(hasErrors(errors)).toBe(true);
  expect(errors.deviceIds).toBeDefined();
  expect(errors.fromUserId).toBeUndefined();
  expect(errors.toUserId).toBeUndefined();
});
