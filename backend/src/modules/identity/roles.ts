// Tên role đã chốt (cột Role.RoleName). "Trưởng phòng" và "Chuyên viên" phân biệt
// phòng ban bằng User.DepartmentId.
export const ROLE = {
  ADMIN: 'Quản trị viên',
  HEAD: 'Trưởng phòng',
  STAFF: 'Nhân viên',
  SPECIALIST: 'Chuyên viên',
} as const;

/** Role vô nghĩa nếu thiếu phòng ban — bắt buộc chọn phòng ban khi tạo user. (Task 2 thay bằng ROLES_BY_DEPARTMENT.) */
export const DEPARTMENT_REQUIRED_ROLES: readonly string[] = [
  ROLE.HEAD,
  ROLE.SPECIALIST,
];
