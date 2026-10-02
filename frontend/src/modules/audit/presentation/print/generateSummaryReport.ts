import { formatDate, matrixTotal, type AuditSummaryDetail } from '../../domain/audit';
import { downloadPdf } from './pdf';

export function buildSummaryReportContent(s: AuditSummaryDetail): string[] {
  const t = matrixTotal(s.matrix);
  return [
    'BẢNG TỔNG HỢP KIỂM KÊ CHI TIẾT',
    `Tiêu đề: ${s.title}`,
    ...(s.purpose ? [`Mục đích: ${s.purpose}`] : []),
    `Người lập: ${s.createdBy.fullName}`,
    `Ngày lập: ${formatDate(s.createdAt)}`,
    '',
    'Các đợt kiểm kê:',
    ...s.audits.map(
      (a) => `- Đợt #${a.id} · ${a.unitName} · ${a.purpose} · đến ${formatDate(a.dueDate)} · ${a.deviceCount} thiết bị`,
    ),
    '',
    'Tổng hợp theo đơn vị và loại thiết bị:',
    ...s.matrix.map(
      (r) => `- ${r.unitName} · ${r.deviceTypeName}: Tổng ${r.total} · Đủ ${r.ok} · Thiếu ${r.missing} · Hỏng ${r.broken}`,
    ),
    `Tổng cộng: Tổng ${t.total} · Đủ ${t.ok} · Thiếu ${t.missing} · Hỏng ${t.broken}`,
  ];
}

export function downloadSummaryReport(s: AuditSummaryDetail): void {
  downloadPdf(`tong-hop-kiem-ke-${s.id}.pdf`, buildSummaryReportContent(s));
}
