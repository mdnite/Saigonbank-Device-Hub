import type { Device } from '@/modules/device/domain/device';

export const ORDER_TYPE = { ALLOCATE: 'Cấp phát', RECOVER: 'Thu hồi' } as const;
export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];

export const ORDER_STATUS = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' } as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export interface UserRef {
  id: number;
  fullName: string;
  username: string;
}

export interface DeviceOrder {
  id: number;
  type: OrderType;
  status: OrderStatus;
  note: string | null;
  rejectReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  targetUser: UserRef;
  createdBy: { id: number; fullName: string };
  decidedBy: { id: number; fullName: string } | null;
  deviceCount: number;
}

export interface DeviceOrderDetail extends DeviceOrder {
  items: { id: number; device: Device }[];
}
