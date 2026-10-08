import { AUDIT_STATUS, formatDate, tally, type AuditDetail, type AuditLine } from '../../domain/audit';
import { downloadPdf } from './pdf';

const outcome = (l: AuditLine) => `${l.result ?? 'Chưa đếm'}${l.note ? ` (${l.note})` : ''}`;

/** Nội dung biên bản kiểm kê, tách khỏi phần vẽ PDF để test được. */
export function buildAuditReportContent(a: AuditDetail): string[] {
  const t = tally(a.items);
  return [
    'BIÊN BẢN KIỂM KÊ THIẾT BỊ',
    `Đơn vị được kiểm kê: ${a.unitName}`,
    `Đến ngày: ${formatDate(a.dueDate)}`,
    `Mục đích: ${a.purpose}`,
    ...(a.deviceTypeName ? [`Loại thiết bị: ${a.deviceTypeName}`] : []),
    ...(a.location ? [`Vị trí: ${a.location}`] : []),
    `Trạng thái: ${a.status}`,
    `Người lập: ${a.createdBy.fullName}`,
    `Người duyệt: ${a.status === AUDIT_STATUS.APPROVED && a.decidedBy ? a.decidedBy.fullName : ''}`,
    `Thành viên tham gia: ${a.members.map((m) => m.fullName).join(', ') || '—'}`,
    '',
    'Danh sách thiết bị:',
    ...a.items.flatMap((i) => [
      `- ${i.deviceCode} · ${i.deviceName} · ${i.holderName ?? a.unitName} · ${outcome(i)}`,
      ...i.accessories.map((x) => `    + ${x.accessoryCode} · ${x.accessoryName} · ${outcome(x)}`),
    ]),
    '',
    `Tổng thiết bị: Đủ ${t.ok} · Thiếu ${t.missing} · Hỏng ${t.broken} · Chưa đếm ${t.uncounted}`,
    '',
    'Người lập: ______________________        Người duyệt: ______________________',
  ];
}

export function downloadAuditReport(a: AuditDetail): void {
  downloadPdf(`bien-ban-kiem-ke-${a.id}.pdf`, buildAuditReportContent(a));
}
