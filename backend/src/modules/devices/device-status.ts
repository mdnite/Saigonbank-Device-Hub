/** Trạng thái thiết bị — lưu nguyên văn tiếng Việt trong DB, giống User.Status. */
export const DEVICE_STATUS = {
  IN_STOCK: 'Trong kho',
  ALLOCATED: 'Đã cấp phát',
  /** Đang nằm trong một đơn Cấp phát / Thu hồi hoặc lệnh Điều chuyển chờ duyệt — bị khoá. */
  PENDING_APPROVAL: 'Đang chờ duyệt',
  PENDING_DISPOSAL: 'Chờ thanh lý',
  DELETED: 'Đã xóa',
} as const;

/** Dùng chung cho Cấp phát - Thu hồi và Điều chuyển: thiết bị đã bị đơn/lệnh khác giữ chỗ. */
export const pendingElsewhere = (deviceCode: string) =>
  `Thiết bị "${deviceCode}" đang chờ duyệt ở đơn/lệnh khác`;

/** Lúc duyệt: thiết bị không còn ở trạng thái giữ chỗ (dữ liệu cũ, hoặc đã bị xử lý). */
export const noLongerPending = (deviceCode: string) =>
  `Thiết bị "${deviceCode}" không còn ở trạng thái chờ duyệt`;

/** Mã thiết bị: tiền tố 2-4 chữ in hoa + gạch nối + đúng 6 chữ số, vd. PC-000123. */
export const DEVICE_CODE_PATTERN = /^[A-Z]{2,4}-\d{6}$/;
export const DEVICE_CODE_MESSAGE = 'Mã thiết bị phải có dạng PC-000123';
