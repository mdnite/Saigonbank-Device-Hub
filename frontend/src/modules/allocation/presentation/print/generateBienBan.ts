import jsPDF from 'jspdf';
import { ORDER_TYPE } from '../../domain/deviceOrder';
import type { DeviceOrderDetail } from '../../domain/deviceOrder';
import { DEJAVU_SANS_BASE64 } from './DejaVuSansBase64';

// A4 rộng 210mm, lề trái 14mm — chừa lề phải tương ứng nên bề rộng khả dụng ~180mm.
const MAX_TEXT_WIDTH_MM = 180;
const LEFT_MARGIN_MM = 14;
const LINE_HEIGHT_MM = 6;

/** Nội dung biên bản, tách riêng khỏi việc vẽ PDF để test được. */
export function buildBienBanContent(o: DeviceOrderDetail): string[] {
  const title =
    o.type === ORDER_TYPE.ALLOCATE ? 'BIÊN BẢN CẤP PHÁT THIẾT BỊ' : 'BIÊN BẢN THU HỒI THIẾT BỊ';
  return [
    title,
    `Số đơn: ${o.id}`,
    `Ngày duyệt: ${o.decidedAt ? o.decidedAt.slice(0, 10) : ''}`,
    `Người lập: ${o.createdBy.fullName}`,
    `Người duyệt: ${o.decidedBy?.fullName ?? ''}`,
    o.type === ORDER_TYPE.ALLOCATE
      ? `Người nhận: ${o.targetUser.fullName}`
      : `Người giữ: ${o.targetUser.fullName}`,
    '',
    'Danh sách thiết bị:',
    ...o.items.map((i) => `- ${i.device.deviceCode} · ${i.device.deviceName} · ${i.device.specDetail}`),
    '',
    'Người giao: ______________________        Người nhận: ______________________',
  ];
}

/** Vẽ và tải file PDF — không letterhead, không nhiều trang, đủ để in ký tay. */
export function downloadBienBan(o: DeviceOrderDetail): void {
  const doc = new jsPDF();
  // Helvetica mặc định của jsPDF chỉ phủ WinAnsi (Latin-1) — không vẽ được dấu tiếng Việt
  // (Ả, Ấ, Ế, Ị, ư, ơ, Đ…). Nhúng DejaVu Sans (phủ đủ Latin Extended) thay thế.
  doc.addFileToVFS('DejaVuSans.ttf', DEJAVU_SANS_BASE64);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.setFont('DejaVuSans');
  doc.setFontSize(11);

  let y = 20;
  for (const line of buildBienBanContent(o)) {
    const wrapped: string[] = doc.splitTextToSize(line, MAX_TEXT_WIDTH_MM);
    doc.text(wrapped, LEFT_MARGIN_MM, y);
    y += wrapped.length * LINE_HEIGHT_MM;
  }
  const kind = o.type === ORDER_TYPE.ALLOCATE ? 'cap-phat' : 'thu-hoi';
  doc.save(`bien-ban-${kind}-${o.id}.pdf`);
}
