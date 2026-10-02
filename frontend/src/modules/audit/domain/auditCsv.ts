import { matrixTotal, type AuditDetail, type AuditSummaryDetail } from './audit';

type Cell = string | number | null | undefined;

const cell = (v: Cell) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV mở thẳng bằng Excel: BOM UTF-8 (không có thì Excel đọc sai tiếng Việt) + CRLF. */
export const toCsv = (rows: Cell[][]) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');

export function auditCsv(a: AuditDetail): string {
  const header = [
    'Mã thiết bị',
    'Tên thiết bị',
    'Linh kiện',
    'Số serial',
    'Loại thiết bị',
    'Đơn vị tính',
    'Đơn vị quản lý',
    'Người sở hữu',
    'Kết quả',
    'Ghi chú',
  ];
  const rows = a.items.flatMap((i) => [
    [
      i.deviceCode,
      i.deviceName,
      '',
      i.serialNumber,
      i.deviceTypeName,
      i.unit,
      i.departmentName ?? a.unitName, // máy Kho: departmentName null, unitName = "Kho"
      i.holderName,
      i.result,
      i.note,
    ],
    ...i.accessories.map((x) => [
      i.deviceCode,
      i.deviceName,
      `${x.accessoryCode} - ${x.accessoryName}`,
      '',
      x.accessoryType,
      x.unit,
      '',
      '',
      x.result,
      x.note,
    ]),
  ]);
  return toCsv([header, ...rows]);
}

export function summaryCsv(s: AuditSummaryDetail): string {
  const t = matrixTotal(s.matrix);
  return toCsv([
    ['Đơn vị', 'Loại thiết bị', 'Tổng', 'Đủ', 'Thiếu', 'Hỏng'],
    ...s.matrix.map((r) => [r.unitName, r.deviceTypeName, r.total, r.ok, r.missing, r.broken]),
    ['Tổng cộng', '', t.total, t.ok, t.missing, t.broken],
  ]);
}
