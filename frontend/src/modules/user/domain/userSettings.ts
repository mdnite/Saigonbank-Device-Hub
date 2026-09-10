/** Domain rules for the account-settings screen (Người dùng / Cài đặt). Pure, unit-tested. */

export interface UserSettings {
  // Thông tin chung — mirrors the required (*) fields on the Figma form
  fullName: string;
  department: string;
  title: string;
  email: string;
  employeeCode: string;
  phone: string;
  note: string;
  // Thông báo — which activity the user wants to be reminded about
  notifyEmail: boolean;
  notifyInApp: boolean;
  notifyAllocation: boolean;
  notifyApproval: boolean;
  notifyTransfer: boolean;
  notifyAudit: boolean;
  // Bảo mật & Quyền riêng tư
  twoFactorEnabled: boolean;
  showActivityStatus: boolean;
}

export const DEPARTMENTS = [
  'Khối Công nghệ thông tin',
  'Khối Vận hành',
  'Khối Khách hàng cá nhân',
  'Chi nhánh Sài Gòn',
  'Chi nhánh Hà Nội',
];

export const TITLES = ['Nhân viên', 'Chuyên viên', 'Trưởng nhóm', 'Trưởng phòng', 'Giám đốc'];

export function emptyUserSettings(): UserSettings {
  return {
    fullName: '',
    department: '',
    title: '',
    email: '',
    employeeCode: '',
    phone: '',
    note: '',
    notifyEmail: true,
    notifyInApp: true,
    notifyAllocation: true,
    notifyApproval: true,
    notifyTransfer: false,
    notifyAudit: true,
    twoFactorEnabled: false,
    showActivityStatus: true,
  };
}

export type UserSettingsErrors = Partial<Record<keyof UserSettings, string>>;

const REQUIRED = 'Bắt buộc';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only the general-info tab has required fields (the red asterisks on the Figma form). */
export function validateUserSettings(s: UserSettings): UserSettingsErrors {
  const errors: UserSettingsErrors = {};
  if (!s.fullName.trim()) errors.fullName = REQUIRED;
  if (!s.department) errors.department = REQUIRED;
  if (!s.title) errors.title = REQUIRED;
  if (!s.employeeCode.trim()) errors.employeeCode = REQUIRED;
  if (!s.email.trim()) errors.email = REQUIRED;
  else if (!EMAIL_RE.test(s.email.trim())) errors.email = 'Email không hợp lệ';
  return errors;
}

export function hasErrors(errors: UserSettingsErrors): boolean {
  return Object.keys(errors).length > 0;
}
