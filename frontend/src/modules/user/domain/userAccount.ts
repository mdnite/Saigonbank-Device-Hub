import { ADMIN_ROLE, HEAD_ROLE, SPECIALIST_ROLE } from '@/modules/auth/domain/session';
import { Email, PASSWORD_MIN_LENGTH } from '@/modules/auth/domain/credentials';

/** Giá trị User.Status đã chốt ở backend (backend/src/modules/identity/user-status.ts). */
export const USER_STATUS = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  DELETED: 'Đã xóa',
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export interface Role {
  id: number;
  roleName: string;
}

export interface Department {
  id: number;
  departmentCode: string;
  departmentName: string;
}

/** 1 dòng trong danh sách quản lý — khớp `UserListItem` của GET /users. */
export interface UserAccount {
  id: number;
  username: string;
  fullName: string;
  email: string;
  status: UserStatus;
  isVerified: boolean;
  createdAt: string;
  role: Role;
  department: Department | null;
}

export interface NewUserDraft {
  username: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  /** id dạng chuỗi vì lấy thẳng từ <select>; '' = chưa chọn. */
  roleId: string;
  departmentId: string;
}

export const emptyNewUserDraft = (): NewUserDraft => ({
  username: '',
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  roleId: '',
  departmentId: '',
});

export type NewUserErrors = Partial<Record<keyof NewUserDraft, string>>;

const REQUIRED = 'Bắt buộc';

/** Giá trị ô Phòng ban khi chọn "— Không (Quản trị viên) —". '' = chưa chọn. */
export const NO_DEPARTMENT = 'NONE';

const STAFF_ROLE = 'Nhân viên';

/** Khớp ROLES_BY_DEPARTMENT ở backend (backend/src/modules/identity/roles.ts). */
const ROLES_BY_DEPARTMENT: Record<string, readonly string[]> = {
  KYTHUAT: [HEAD_ROLE, SPECIALIST_ROLE, STAFF_ROLE],
  KETOAN: [HEAD_ROLE, SPECIALIST_ROLE, STAFF_ROLE],
  KINHDOANH: [HEAD_ROLE, STAFF_ROLE],
  NGHIEPVU: [HEAD_ROLE, STAFF_ROLE],
};

export function allowedRoleNames(departmentCode: string | null): readonly string[] {
  return departmentCode === null ? [ADMIN_ROLE] : (ROLES_BY_DEPARTMENT[departmentCode] ?? []);
}

/** `roleName` / `departmentCode`: tra từ danh mục theo draft; undefined = danh mục chưa tải, không kiểm tổ hợp. */
export function validateNewUser(
  d: NewUserDraft,
  roleName?: string,
  departmentCode?: string | null,
): NewUserErrors {
  const errors: NewUserErrors = {};
  if (!d.username.trim()) errors.username = REQUIRED;
  if (!d.fullName.trim()) errors.fullName = REQUIRED;
  if (!d.email.trim()) errors.email = REQUIRED;
  else if (!Email.isValid(d.email)) errors.email = 'Email không hợp lệ';
  if (d.password.length < PASSWORD_MIN_LENGTH)
    errors.password = `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`;
  if (d.confirmPassword !== d.password) errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
  if (!d.departmentId) errors.departmentId = 'Vui lòng chọn phòng ban';
  if (!d.roleId) errors.roleId = REQUIRED;
  else if (roleName && departmentCode !== undefined && !allowedRoleNames(departmentCode).includes(roleName))
    errors.roleId = 'Chức vụ không thuộc phòng ban đã chọn';
  return errors;
}
