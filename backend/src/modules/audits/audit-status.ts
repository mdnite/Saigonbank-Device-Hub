/** Trạng thái đợt kiểm kê — lưu nguyên văn tiếng Việt, giống Device.Status. */
export const AUDIT_STATUS = {
  NOT_STARTED: 'Chưa kiểm kê',
  IN_PROGRESS: 'Đang kiểm kê',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  CANCELLED: 'Đã hủy',
  DELETED: 'Đã xóa',
} as const;

/** Đợt "đang mở" giữ các thiết bị của nó: thiết bị không được nằm trong 2 đợt đang mở (#10). */
export const OPEN_AUDIT_STATUSES: string[] = [
  AUDIT_STATUS.NOT_STARTED,
  AUDIT_STATUS.IN_PROGRESS,
  AUDIT_STATUS.PENDING,
];

/** Xoá mềm được ở mọi trạng thái trừ Chờ duyệt (và đã xoá). */
export const DELETABLE_AUDIT_STATUSES: string[] = [
  AUDIT_STATUS.NOT_STARTED,
  AUDIT_STATUS.IN_PROGRESS,
  AUDIT_STATUS.APPROVED,
  AUDIT_STATUS.CANCELLED,
];

export const AUDIT_RESULT = {
  OK: 'Đủ',
  MISSING: 'Thiếu',
  BROKEN: 'Hỏng',
} as const;

export const AUDIT_PURPOSE = {
  PERIODIC: 'Định kỳ',
  AD_HOC: 'Đột xuất',
  YEAR_END: 'Cuối năm',
} as const;

/** Tên đơn vị giả cho thiết bị Trong kho (Audit.DepartmentId = null). */
export const WAREHOUSE_UNIT_NAME = 'Kho';

export const AUDIT_NOT_FOUND = 'Đợt kiểm kê không tồn tại';
export const LINE_NOT_FOUND = 'Dòng kiểm kê không tồn tại';
export const SUMMARY_NOT_FOUND = 'Bảng tổng hợp không tồn tại';
export const AUDIT_WRONG_STATE =
  'Đợt kiểm kê đã được xử lý hoặc không ở trạng thái phù hợp';

export const devicesChanged = (codes: string[]) =>
  `Thiết bị ${codes.join(', ')} đã thay đổi kể từ lúc lập lịch — từ chối đợt và sửa kết quả các dòng này`;
