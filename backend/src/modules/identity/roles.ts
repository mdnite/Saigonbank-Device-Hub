// Tên role đã chốt (cột Role.RoleName). "Trưởng phòng" và "Chuyên viên" phân biệt
// phòng ban bằng User.DepartmentId.
export const ROLE = {
  ADMIN: 'Quản trị viên',
  HEAD: 'Trưởng phòng',
  STAFF: 'Nhân viên',
  SPECIALIST: 'Chuyên viên',
} as const;

/** Chức vụ hợp lệ theo DepartmentCode. Không phòng ban → chỉ Quản trị viên. */
export const ROLES_BY_DEPARTMENT: Record<string, readonly string[]> = {
  KYTHUAT: [ROLE.HEAD, ROLE.SPECIALIST, ROLE.STAFF],
  KETOAN: [ROLE.HEAD, ROLE.SPECIALIST, ROLE.STAFF],
  KINHDOANH: [ROLE.HEAD, ROLE.STAFF],
  NGHIEPVU: [ROLE.HEAD, ROLE.STAFF],
};

export function roleAllowedFor(
  roleName: string,
  departmentCode: string | null,
): boolean {
  if (departmentCode === null) return roleName === ROLE.ADMIN;
  return (ROLES_BY_DEPARTMENT[departmentCode] ?? []).includes(roleName);
}
