export interface TransferDraft {
  fromUserId: number | null;
  toUserId: number | null;
  deviceIds: number[];
  note: string;
}

export function emptyTransferDraft(): TransferDraft {
  return { fromUserId: null, toUserId: null, deviceIds: [], note: '' };
}

export type TransferDraftErrors = Partial<Record<'fromUserId' | 'toUserId' | 'deviceIds', string>>;

const REQUIRED = 'Bắt buộc';

export function validateTransferDraft(d: TransferDraft): TransferDraftErrors {
  const errors: TransferDraftErrors = {};
  if (d.fromUserId === null) errors.fromUserId = REQUIRED;
  if (d.toUserId === null) errors.toUserId = REQUIRED;
  else if (d.fromUserId !== null && d.toUserId === d.fromUserId) {
    errors.toUserId = 'Người nhận phải khác người đang giữ';
  }
  if (d.deviceIds.length === 0) errors.deviceIds = 'Vui lòng chọn ít nhất 1 thiết bị';
  return errors;
}

export function hasErrors(errors: TransferDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
