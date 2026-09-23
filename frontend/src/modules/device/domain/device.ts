/** Trạng thái thiết bị — chuỗi tiếng Việt y hệt giá trị backend lưu trong DB. */
export const DEVICE_STATUS = {
  IN_STOCK: 'Trong kho',
  ALLOCATED: 'Đã cấp phát',
  PENDING_DISPOSAL: 'Chờ thanh lý',
  DELETED: 'Đã xóa',
} as const;

export type DeviceStatus = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS];

/** 4 trạng thái hiện trong bộ lọc danh mục — soft-delete nên "Đã xóa" vẫn xem lại được. */
export const DEVICE_STATUS_OPTIONS: DeviceStatus[] = [
  DEVICE_STATUS.IN_STOCK,
  DEVICE_STATUS.ALLOCATED,
  DEVICE_STATUS.PENDING_DISPOSAL,
  DEVICE_STATUS.DELETED,
];

export interface DeviceTypeRef { id: number; typeName: string; prefix: string }
export interface DepartmentRef { id: number; departmentCode: string; departmentName: string }
export interface UserRef { id: number; fullName: string; username: string }

export interface Device {
  id: number;
  deviceCode: string;
  deviceName: string;
  serialNumber: string | null;
  specDetail: string;
  unit: string;
  status: DeviceStatus;
  allocatedOn: string | null;
  location: string | null;
  purchaseDate: string | null;
  supplier: string | null;
  warrantyMonths: number | null;
  warrantyCondition: string | null;
  warrantyExpiresOn: string | null;
  deviceType: DeviceTypeRef;
  department: DepartmentRef | null;
  currentUser: UserRef | null;
  accessories: {
    id: number;
    accessoryCode: string;
    accessoryName: string;
    accessoryType: string;
    unit: string;
  }[];
}
