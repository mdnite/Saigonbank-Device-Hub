import { describe, expect, it } from 'vitest';
import type { AuditDetail, AuditSummaryDetail } from './audit';
import { auditCsv, summaryCsv, toCsv } from './auditCsv';

const detail = {
  unitName: 'Kho',
  items: [
    {
      deviceCode: 'LT-000001',
      deviceName: 'Dell, bản "Pro"',
      serialNumber: 'SN1',
      deviceTypeName: 'Laptop',
      unit: 'Cái',
      holderName: null,
      departmentName: null,
      result: 'Thiếu',
      note: 'mất\nsạc',
      accessories: [
        { accessoryCode: 'SAC-1', accessoryName: 'Sạc', accessoryType: 'Nguồn', unit: 'Cái', result: 'Đủ', note: null },
      ],
    },
  ],
} as unknown as AuditDetail;

describe('toCsv', () => {
  it('chống công thức: ô chữ bắt đầu = + - @ tab CR được thêm dấu nháy đơn, số giữ nguyên', () => {
    expect(toCsv([['=1+1', '+a', '-b', '@c', '\td', 'ok-1', 5, -3]])).toBe("﻿'=1+1,'+a,'-b,'@c,'\td,ok-1,5,-3");
    expect(toCsv([['\rx']])).toBe('﻿"\'\rx"');
  });

  it('BOM UTF-8 + CRLF, escape dấu phẩy / nháy kép / xuống dòng, null = rỗng', () => {
    expect(toCsv([['a', 'b,c'], ['"x"', null]])).toBe('﻿a,"b,c"\r\n"""x""",');
  });
});

describe('auditCsv', () => {
  it('1 dòng thiết bị + 1 dòng mỗi linh kiện; máy Kho ghi đơn vị quản lý "Kho"', () => {
    const lines = auditCsv(detail).slice(1).split('\r\n');
    expect(lines[0]).toBe(
      'Mã thiết bị,Tên thiết bị,Linh kiện,Số serial,Loại thiết bị,Đơn vị tính,Đơn vị quản lý,Người sở hữu,Kết quả,Ghi chú',
    );
    expect(lines[1]).toBe('LT-000001,"Dell, bản ""Pro""",,SN1,Laptop,Cái,Kho,,Thiếu,"mất\nsạc"');
    expect(lines[2]).toBe('LT-000001,"Dell, bản ""Pro""",SAC-1 - Sạc,,Nguồn,Cái,,,Đủ,');
  });
});

describe('summaryCsv', () => {
  it('ma trận + dòng tổng', () => {
    const s = {
      matrix: [{ unitName: 'Kho', deviceTypeName: 'Laptop', total: 2, ok: 1, missing: 1, broken: 0 }],
    } as unknown as AuditSummaryDetail;
    expect(summaryCsv(s).slice(1).split('\r\n')).toEqual([
      'Đơn vị,Loại thiết bị,Tổng,Đủ,Thiếu,Hỏng',
      'Kho,Laptop,2,1,1,0',
      'Tổng cộng,,2,1,1,0',
    ]);
  });
});
