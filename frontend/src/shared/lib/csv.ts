export type CsvCell = string | number | null | undefined;

const cell = (v: CsvCell) => {
  let s = v == null ? '' : String(v);
  // Chống CSV injection: ô văn bản bắt đầu bằng = + - @ tab CR bị Excel hiểu là công thức. Số giữ nguyên.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV mở thẳng bằng Excel: BOM UTF-8 (không có thì Excel đọc sai tiếng Việt) + CRLF. */
export const toCsv = (rows: CsvCell[][]) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
