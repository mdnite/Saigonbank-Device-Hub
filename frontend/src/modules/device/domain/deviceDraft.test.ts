import { describe, expect, it } from 'vitest';
import { emptyDeviceDraft, validateDeviceDraft } from './deviceDraft';

describe('validateDeviceDraft', () => {
  it('báo đủ trường bắt buộc trên draft rỗng', () => {
    const errors = validateDeviceDraft(emptyDeviceDraft());
    expect(Object.keys(errors).sort()).toEqual(
      ['deviceCode', 'deviceName', 'deviceTypeId', 'specDetail', 'unit'].sort(),
    );
  });

  it('bắt mã sai định dạng', () => {
    const d = { ...emptyDeviceDraft(), deviceCode: 'LT-1' };
    expect(validateDeviceDraft(d).deviceCode).toBe('Mã thiết bị phải có dạng PC-000123');
  });

  it('chấp nhận mã đúng định dạng', () => {
    const d = {
      ...emptyDeviceDraft(),
      deviceCode: 'PC-000123',
      deviceName: 'Máy bàn HP',
      specDetail: 'i5 · 8GB',
      unit: 'Cái',
      deviceTypeId: 2,
    };
    expect(validateDeviceDraft(d)).toEqual({});
  });
});
