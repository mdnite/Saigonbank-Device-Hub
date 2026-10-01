// Tên role đã chốt (cột Role.RoleName). "Trưởng phòng" và "Cộng tác viên" phân biệt
// Kế toán / Kỹ thuật bằng User.DepartmentId.
export const ROLE = {
  ADMIN: 'Quản trị viên',
  HEAD: 'Trưởng phòng',
  STAFF: 'Nhân viên',
  COLLAB: 'Cộng tác viên',
} as const;

/** Role vô nghĩa nếu thiếu phòng ban — bắt buộc chọn phòng ban khi tạo user. */
export const DEPARTMENT_REQUIRED_ROLES: readonly string[] = [
  ROLE.HEAD,
  ROLE.COLLAB,
];
