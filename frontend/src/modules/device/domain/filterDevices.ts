import type { Device } from './device';

export interface DeviceFilter {
  search: string;
  typeId: number | null;
  location: string;
}

export const EMPTY_DEVICE_FILTER: DeviceFilter = { search: '', typeId: null, location: '' };

/** Lọc phía client cho danh sách thiết bị trong form đơn/lệnh (danh sách đã tải sẵn, nhỏ). */
export function filterDevices(devices: Device[], f: DeviceFilter): Device[] {
  const q = f.search.trim().toLowerCase();
  return devices.filter(
    (d) =>
      (!q || [d.deviceCode, d.deviceName, d.serialNumber ?? ''].some((s) => s.toLowerCase().includes(q))) &&
      (f.typeId === null || d.deviceType.id === f.typeId) &&
      (!f.location || d.location === f.location),
  );
}

/** Các vị trí đang có trong danh sách (bỏ máy không có vị trí). */
export function deviceLocations(devices: Device[]): string[] {
  return [...new Set(devices.flatMap((d) => (d.location ? [d.location] : [])))].sort((a, b) =>
    a.localeCompare(b, 'vi'),
  );
}
