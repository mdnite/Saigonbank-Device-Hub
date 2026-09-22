/** Trạng thái thiết bị — lưu nguyên văn tiếng Việt trong DB, giống User.Status. */
export const DEVICE_STATUS = {
  IN_STOCK: 'Trong kho',
  ALLOCATED: 'Đã cấp phát',
  PENDING_DISPOSAL: 'Chờ thanh lý',
  DELETED: 'Đã xóa',
} as const;

/** 3 trạng thái người dùng được phép đặt qua PATCH. "Đã xóa" chỉ do DELETE đặt. */
export const ASSIGNABLE_DEVICE_STATUSES: string[] = [
  DEVICE_STATUS.IN_STOCK,
  DEVICE_STATUS.ALLOCATED,
  DEVICE_STATUS.PENDING_DISPOSAL,
];

/** Mã thiết bị: tiền tố 2-4 chữ in hoa + gạch nối + đúng 6 chữ số, vd. PC-000123. */
export const DEVICE_CODE_PATTERN = /^[A-Z]{2,4}-\d{6}$/;
export const DEVICE_CODE_MESSAGE = 'Mã thiết bị phải có dạng PC-000123';
