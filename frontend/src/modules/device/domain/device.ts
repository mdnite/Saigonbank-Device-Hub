export type DeviceStatus = 'IN_STOCK' | 'ALLOCATED' | 'PENDING_DISPOSAL';

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  IN_STOCK: 'Trong kho',
  ALLOCATED: 'Đã cấp phát',
  PENDING_DISPOSAL: 'Chờ thanh lý',
};

export const DEVICE_STATUSES = Object.keys(DEVICE_STATUS_LABEL) as DeviceStatus[];

export interface DeviceSpec {
  cpu: string;
  ram: string;
  storage: string;
}

export interface Device {
  id: string; // e.g. "LT-DELL-001"
  name: string; // e.g. "Dell Latitude 5420"
  spec: DeviceSpec;
  owner: string | null; // "Nguyễn Văn A - IT" or null when unassigned
  status: DeviceStatus;
}

/** "Intel Core i5-1135G7 · 16GB RAM · 512GB SSD" */
export function specSummary(spec: DeviceSpec): string {
  return [spec.cpu, spec.ram, spec.storage].filter(Boolean).join(' · ');
}
