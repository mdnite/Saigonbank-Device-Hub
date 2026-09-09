export interface DeviceComponent {
  code: string;
  name: string;
  type: string;
  unit: string;
}

export type AllocationTarget = 'EMPLOYEE' | 'DEPARTMENT';
export type WarrantyUnit = 'MONTH' | 'YEAR';

export interface AssetDraft {
  // Thông tin chung
  managingUnit: string;
  location: string;
  owner: string;
  purchaseDate: string;
  deviceCode: string;
  supplier: string;
  deviceName: string;
  specDetail: string;
  // Linh kiện
  components: DeviceComponent[];
  // Đã cấp phát
  allocated: boolean;
  allocatedOn: string;
  jobLocation: string;
  targetType: AllocationTarget;
  employee: string;
  recordNo: string;
  // Bảo hành
  warrantyDuration: string;
  warrantyUnit: WarrantyUnit;
  warrantyCondition: string;
  warrantyExpiresOn: string;
}

export function emptyAssetDraft(): AssetDraft {
  return {
    managingUnit: '',
    location: '',
    owner: '',
    purchaseDate: '',
    deviceCode: '',
    supplier: '',
    deviceName: '',
    specDetail: '',
    components: [],
    allocated: false,
    allocatedOn: '',
    jobLocation: '',
    targetType: 'EMPLOYEE',
    employee: '',
    recordNo: '',
    warrantyDuration: '',
    warrantyUnit: 'MONTH',
    warrantyCondition: '',
    warrantyExpiresOn: '',
  };
}

export type AssetDraftErrors = Partial<Record<keyof AssetDraft, string>>;

const REQUIRED = 'Bắt buộc';

/** Mirrors the red asterisks on the Figma form. */
export function validateAssetDraft(d: AssetDraft): AssetDraftErrors {
  const errors: AssetDraftErrors = {};
  if (!d.managingUnit.trim()) errors.managingUnit = REQUIRED;
  if (!d.location.trim()) errors.location = REQUIRED;
  if (!d.owner.trim()) errors.owner = REQUIRED;
  if (!d.deviceCode.trim()) errors.deviceCode = REQUIRED;
  if (!d.deviceName.trim()) errors.deviceName = REQUIRED;
  if (!d.specDetail.trim()) errors.specDetail = REQUIRED;
  if (d.allocated) {
    if (!d.employee.trim()) errors.employee = REQUIRED;
    if (!d.recordNo.trim()) errors.recordNo = REQUIRED;
  }
  return errors;
}

export function hasErrors(errors: AssetDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
