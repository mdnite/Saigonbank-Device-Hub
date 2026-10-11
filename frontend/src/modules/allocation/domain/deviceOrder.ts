import type { Device } from '@/modules/device/domain/device';

export const ORDER_TYPE = { ALLOCATE: 'Cấp phát', RECOVER: 'Thu hồi' } as const;
export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];

export const ORDER_STATUS = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', DELETED: 'Đã xóa' } as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export interface UserRef {
  id: number;
  fullName: string;
  username: string;
  departmentId: number | null;
}

/** 1 dòng của GET /departments — cho ô chọn phòng ban trước khi chọn người. */
export interface DepartmentRef {
  id: number;
  departmentCode: string;
  departmentName: string;
}

/** Đơn còn xoá mềm được (TP Kỹ thuật): Đã duyệt hoặc Từ chối. */
export const isOrderDeletable = (status: OrderStatus) =>
  status === ORDER_STATUS.APPROVED || status === ORDER_STATUS.REJECTED;

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
