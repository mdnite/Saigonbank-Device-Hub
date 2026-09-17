// Giá trị cột User.Status đã chốt. Không phải enum DB (cột varchar theo ERD) — chỉ ràng buộc ở tầng service.
export const USER_STATUS = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  DELETED: 'Đã xóa',
} as const;
