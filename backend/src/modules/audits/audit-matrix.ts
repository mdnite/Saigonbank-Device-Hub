import { AUDIT_RESULT } from './audit-status';

export interface MatrixRow {
  unitName: string;
  deviceTypeName: string;
  total: number;
  ok: number;
  missing: number;
  broken: number;
}

/** Ma trận đơn vị × loại thiết bị của bảng tổng hợp (#22) — chỉ đếm thiết bị, không đếm linh kiện. */
export function buildMatrix(
  audits: {
    unitName: string;
    items: { deviceTypeName: string; result: string | null }[];
  }[],
): MatrixRow[] {
  const rows = new Map<string, MatrixRow>();
  for (const a of audits) {
    for (const i of a.items) {
      const key = `${a.unitName}\u0000${i.deviceTypeName}`;
      const row = rows.get(key) ?? {
        unitName: a.unitName,
        deviceTypeName: i.deviceTypeName,
        total: 0,
        ok: 0,
        missing: 0,
        broken: 0,
      };
      row.total++;
      if (i.result === AUDIT_RESULT.OK) row.ok++;
      else if (i.result === AUDIT_RESULT.MISSING) row.missing++;
      else if (i.result === AUDIT_RESULT.BROKEN) row.broken++;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort(
    (x, y) =>
      x.unitName.localeCompare(y.unitName, 'vi') ||
      x.deviceTypeName.localeCompare(y.deviceTypeName, 'vi'),
  );
}
