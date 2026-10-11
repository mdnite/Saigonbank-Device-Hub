import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('chống công thức: ô chữ bắt đầu = + - @ tab CR được thêm dấu nháy đơn, số giữ nguyên', () => {
    expect(toCsv([['=1+1', '+a', '-b', '@c', '\td', 'ok-1', 5, -3]])).toBe("﻿'=1+1,'+a,'-b,'@c,'\td,ok-1,5,-3");
    expect(toCsv([['\rx']])).toBe('﻿"\'\rx"');
  });

  it('BOM UTF-8 + CRLF, escape dấu phẩy / nháy kép / xuống dòng, null = rỗng', () => {
    expect(toCsv([['a', 'b,c'], ['"x"', null]])).toBe('﻿a,"b,c"\r\n"""x""",');
  });
});
