/** Trạng thái lệnh điều chuyển — cùng 3 giá trị tiếng Việt của DeviceOrder, định nghĩa riêng để
 *  không import chéo module (giống cách DEVICE_STATUS/ORDER_STATUS đã tách nhau). */
export const TRANSFER_STATUS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
} as const;
