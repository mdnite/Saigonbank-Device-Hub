import type { DeviceTransferDetail } from '../../domain/deviceTransfer';

// ponytail: implementation thật (jsPDF, font dùng chung từ shared/print) nằm ở Task 12 của plan
// này — đây chỉ là chữ ký hàm để biên dịch được.
export function downloadBienBan(_transfer: DeviceTransferDetail): void {
  throw new Error('Chưa triển khai — xem Task 12');
}
