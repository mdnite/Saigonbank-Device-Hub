export interface DeviceAccessoryDraft {
  accessoryCode: string;
  accessoryName: string;
  accessoryType: string;
  unit: string;
}

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
  departmentId: number | null;
  currentUserId: number | null;
  allocated: boolean;
  allocatedOn: string;
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
    departmentId: null,
    currentUserId: null,
    allocated: false,
    allocatedOn: '',
    accessories: [],
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
  if (d.allocated && d.currentUserId === null) errors.currentUserId = REQUIRED;
  return errors;
}

export function hasErrors(errors: DeviceDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
