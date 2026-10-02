import { buildMatrix } from './audit-matrix';

describe('buildMatrix', () => {
  it('gộp theo đơn vị × loại, đếm Đủ / Thiếu / Hỏng, sắp theo đơn vị rồi loại', () => {
    const rows = buildMatrix([
      {
        unitName: 'Phòng Kỹ thuật',
        items: [
          { deviceTypeName: 'Laptop', result: 'Đủ' },
          { deviceTypeName: 'Laptop', result: 'Thiếu' },
          { deviceTypeName: 'Máy in', result: 'Hỏng' },
        ],
      },
      { unitName: 'Kho', items: [{ deviceTypeName: 'Laptop', result: 'Đủ' }] },
      {
        unitName: 'Phòng Kỹ thuật',
        items: [{ deviceTypeName: 'Laptop', result: 'Đủ' }],
      },
    ]);
    expect(rows).toEqual([
      {
        unitName: 'Kho',
        deviceTypeName: 'Laptop',
        total: 1,
        ok: 1,
        missing: 0,
        broken: 0,
      },
      {
        unitName: 'Phòng Kỹ thuật',
        deviceTypeName: 'Laptop',
        total: 3,
        ok: 2,
        missing: 1,
        broken: 0,
      },
      {
        unitName: 'Phòng Kỹ thuật',
        deviceTypeName: 'Máy in',
        total: 1,
        ok: 0,
        missing: 0,
        broken: 1,
      },
    ]);
  });

  it('không đợt nào: mảng rỗng', () => {
    expect(buildMatrix([])).toEqual([]);
  });
});
