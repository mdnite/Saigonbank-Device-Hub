import jsPDF from 'jspdf';
import { DEJAVU_SANS_BASE64 } from '@/shared/print/DejaVuSansBase64';

// A4 210×297mm, lề trái 14mm, bề rộng khả dụng ~180mm; quá đáy 280mm thì sang trang.
const MAX_TEXT_WIDTH_MM = 180;
const LEFT_MARGIN_MM = 14;
const TOP_MM = 20;
const BOTTOM_MM = 280;
const LINE_HEIGHT_MM = 6;

/** Vẽ từng dòng (tự xuống dòng, tự sang trang) bằng DejaVu Sans rồi tải về. */
export function downloadPdf(filename: string, lines: string[]): void {
  const doc = new jsPDF();
  // Helvetica của jsPDF chỉ phủ Latin-1 — không vẽ được dấu tiếng Việt. Nhúng DejaVu Sans.
  doc.addFileToVFS('DejaVuSans.ttf', DEJAVU_SANS_BASE64);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.setFont('DejaVuSans');
  doc.setFontSize(11);

  let y = TOP_MM;
  for (const line of lines) {
    const wrapped: string[] = doc.splitTextToSize(line, MAX_TEXT_WIDTH_MM);
    for (const part of wrapped) {
      if (y > BOTTOM_MM) {
        doc.addPage();
        y = TOP_MM;
      }
      doc.text(part, LEFT_MARGIN_MM, y);
      y += LINE_HEIGHT_MM;
    }
  }
  doc.save(filename);
}
