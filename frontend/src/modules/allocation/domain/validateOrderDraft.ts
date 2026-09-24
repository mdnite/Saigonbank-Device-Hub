import type { OrderType } from './deviceOrder';

export interface OrderDraft {
  type: OrderType | '';
  targetUserId: number | null;
  deviceIds: number[];
  note: string;
}

export function emptyOrderDraft(): OrderDraft {
  return { type: '', targetUserId: null, deviceIds: [], note: '' };
}

export type OrderDraftErrors = Partial<Record<'type' | 'targetUserId' | 'deviceIds', string>>;

const REQUIRED = 'Bắt buộc';

export function validateOrderDraft(d: OrderDraft): OrderDraftErrors {
  const errors: OrderDraftErrors = {};
  if (!d.type) errors.type = REQUIRED;
  if (d.targetUserId === null) errors.targetUserId = REQUIRED;
  if (d.deviceIds.length === 0) errors.deviceIds = 'Vui lòng chọn ít nhất 1 thiết bị';
  return errors;
}

export function hasErrors(errors: OrderDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
