import type { Device } from './device';

export interface DeviceAccessoryDraft {
  accessoryCode: string;
  accessoryName: string;
  accessoryType: string;
  unit: string;
}

/** Chỉ thông tin thiết bị. Người giữ / ngày cấp / trạng thái chỉ đổi qua đơn Cấp phát - Thu hồi và lệnh Điều chuyển. */
export interface DeviceDraft {
  deviceCode: string;
  deviceName: string;
  serialNumber: string;
  specDetail: string;
  unit: string;
  deviceTypeId: number | null;
  location: string;
  purchaseDate: string;
  supplier: string;
  warrantyMonths: string;
  warrantyCondition: string;
  warrantyExpiresOn: string;
  accessories: DeviceAccessoryDraft[];
}

export function emptyDeviceDraft(): DeviceDraft {
  return {
    deviceCode: '',
    deviceName: '',
    serialNumber: '',
    specDetail: '',
    unit: '',
    deviceTypeId: null,
    location: '',
    purchaseDate: '',
    supplier: '',
    warrantyMonths: '',
    warrantyCondition: '',
    warrantyExpiresOn: '',
    accessories: [],
  };
}

/**
 * Device (đọc từ API) → DeviceDraft (dạng form) để nạp sẵn trang sửa.
 * API trả ngày dạng ISO datetime ("2026-09-22T00:00:00.000Z"); <input type="date"> chỉ nhận
 * "yyyy-MM-dd", giá trị khác bị trình duyệt làm rỗng — nên cắt 10 ký tự đầu ngay tại đây.
 */
export function deviceToDraft(d: Device): DeviceDraft {
  const dateOnly = (v: string | null) => v?.slice(0, 10) ?? '';
  return {
    deviceCode: d.deviceCode,
    deviceName: d.deviceName,
    serialNumber: d.serialNumber ?? '',
    specDetail: d.specDetail,
    unit: d.unit,
    deviceTypeId: d.deviceType.id,
    location: d.location ?? '',
    purchaseDate: dateOnly(d.purchaseDate),
    supplier: d.supplier ?? '',
    warrantyMonths: d.warrantyMonths != null ? String(d.warrantyMonths) : '',
    warrantyCondition: d.warrantyCondition ?? '',
    warrantyExpiresOn: dateOnly(d.warrantyExpiresOn),
    accessories: d.accessories.map(({ accessoryCode, accessoryName, accessoryType, unit }) => ({
      accessoryCode,
      accessoryName,
      accessoryType,
      unit,
    })),
  };
}

export type DeviceDraftErrors = Partial<Record<keyof DeviceDraft, string>>;

const REQUIRED = 'Bắt buộc';
/** Giữ khớp 1:1 với DEVICE_CODE_PATTERN ở backend/src/modules/devices/device-status.ts. */
export const DEVICE_CODE_PATTERN = /^[A-Z]{2,4}-\d{6}$/;
export const DEVICE_CODE_MESSAGE = 'Mã thiết bị phải có dạng PC-000123';

export function validateDeviceDraft(d: DeviceDraft): DeviceDraftErrors {
  const errors: DeviceDraftErrors = {};
  if (!d.deviceCode.trim()) errors.deviceCode = REQUIRED;
  else if (!DEVICE_CODE_PATTERN.test(d.deviceCode.trim())) {
    errors.deviceCode = DEVICE_CODE_MESSAGE;
  }
  if (!d.deviceName.trim()) errors.deviceName = REQUIRED;
  if (!d.specDetail.trim()) errors.specDetail = REQUIRED;
  if (!d.unit.trim()) errors.unit = REQUIRED;
  if (d.deviceTypeId === null) errors.deviceTypeId = REQUIRED;
  return errors;
}

export function hasErrors(errors: DeviceDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
