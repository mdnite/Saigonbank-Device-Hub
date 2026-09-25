import type { Device } from '@/modules/device/domain/device';

export const TRANSFER_STATUS = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' } as const;
export type TransferStatus = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];

export interface UserRef {
  id: number;
  fullName: string;
  username: string;
}

export interface DeviceTransfer {
  id: number;
  status: TransferStatus;
  note: string | null;
  rejectReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  fromUser: UserRef;
  toUser: UserRef;
  createdBy: { id: number; fullName: string };
  decidedBy: { id: number; fullName: string } | null;
  deviceCount: number;
}

export interface DeviceTransferDetail extends DeviceTransfer {
  items: { id: number; device: Device }[];
}
