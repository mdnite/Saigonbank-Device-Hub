import jsPDF from 'jspdf';
import { DEJAVU_SANS_BASE64 } from '@/shared/print/DejaVuSansBase64';
import type { DeviceTransferDetail } from '../../domain/deviceTransfer';

// A4 rộng 210mm, lề trái 14mm — chừa lề phải tương ứng nên bề rộng khả dụng ~180mm.
const MAX_TEXT_WIDTH_MM = 180;
const LEFT_MARGIN_MM = 14;
const LINE_HEIGHT_MM = 6;

/** Nội dung biên bản, tách riêng khỏi việc vẽ PDF để test được. */
export function buildBienBanContent(t: DeviceTransferDetail): string[] {
  return [
    'BIÊN BẢN ĐIỀU CHUYỂN THIẾT BỊ',
    `Số đơn: ${t.id}`,
    `Ngày duyệt: ${t.decidedAt ? t.decidedAt.slice(0, 10) : ''}`,
    `Người lập: ${t.createdBy.fullName}`,
    `Người duyệt: ${t.decidedBy?.fullName ?? ''}`,
    `Người giao: ${t.fromUser.fullName}`,
    `Người nhận: ${t.toUser.fullName}`,
    '',
    'Danh sách thiết bị:',
    ...t.items.map((i) => `- ${i.device.deviceCode} · ${i.device.deviceName} · ${i.device.specDetail}`),
    '',
    'Người giao: ______________________        Người nhận: ______________________',
  ];
}

/** Vẽ và tải file PDF — không letterhead, không nhiều trang, đủ để in ký tay. Dùng lại đúng font
 *  DejaVu Sans đã nhúng sẵn ở shared/print/ (không nhúng lại — xem Task 7 của plan này). */
export function downloadBienBan(t: DeviceTransferDetail): void {
  const doc = new jsPDF();
  doc.addFileToVFS('DejaVuSans.ttf', DEJAVU_SANS_BASE64);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.setFont('DejaVuSans');
  doc.setFontSize(11);

  let y = 20;
  for (const line of buildBienBanContent(t)) {
    const wrapped: string[] = doc.splitTextToSize(line, MAX_TEXT_WIDTH_MM);
    doc.text(wrapped, LEFT_MARGIN_MM, y);
    y += wrapped.length * LINE_HEIGHT_MM;
  }
  doc.save(`bien-ban-dieu-chuyen-${t.id}.pdf`);
}
