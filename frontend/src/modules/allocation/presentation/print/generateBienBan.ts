import jsPDF from 'jspdf';
import { ORDER_TYPE } from '../../domain/deviceOrder';
import type { DeviceOrderDetail } from '../../domain/deviceOrder';

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
  let y = 20;
  for (const line of buildBienBanContent(o)) {
    doc.text(line, 14, y);
    y += 8;
  }
  const kind = o.type === ORDER_TYPE.ALLOCATE ? 'cap-phat' : 'thu-hoi';
  doc.save(`bien-ban-${kind}-${o.id}.pdf`);
}
