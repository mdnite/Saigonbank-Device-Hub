/** Loại đơn — lưu nguyên văn tiếng Việt trong DB, giống Device.Status. */
export const ORDER_TYPE = {
  ALLOCATE: 'Cấp phát',
  RECOVER: 'Thu hồi',
} as const;

/** Trạng thái đơn. "Chờ duyệt" là mặc định khi tạo — chỉ Admin đổi sang 2 trạng thái còn lại. */
export const ORDER_STATUS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
} as const;
