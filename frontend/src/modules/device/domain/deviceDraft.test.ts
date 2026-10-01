import { describe, expect, it } from 'vitest';
import type { Device } from './device';
import { deviceToDraft, emptyDeviceDraft, validateDeviceDraft } from './deviceDraft';

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

const device = (over: Partial<Device> = {}): Device => ({
  id: 1,
  deviceCode: 'LT-000001',
  deviceName: 'Dell Latitude 5420',
  serialNumber: null,
  specDetail: 'i5 · 16GB',
  unit: 'Cái',
  status: 'Trong kho',
  allocatedOn: null,
  location: null,
  purchaseDate: null,
  supplier: null,
  warrantyMonths: null,
  warrantyCondition: null,
  warrantyExpiresOn: null,
  deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' },
  currentUser: null,
  accessories: [],
  ...over,
});

describe('deviceToDraft', () => {
  it('cắt ISO datetime của API về yyyy-MM-dd cho <input type="date">', () => {
    const d = deviceToDraft(
      device({
        purchaseDate: '2026-09-22T00:00:00.000Z',
        warrantyExpiresOn: '2028-09-22T00:00:00.000Z',
      }),
    );
    expect(d.purchaseDate).toBe('2026-09-22');
    expect(d.warrantyExpiresOn).toBe('2028-09-22');
  });

  it('draft không mang người giữ / ngày cấp / phòng ban — các trường đó chỉ đổi qua đơn/lệnh', () => {
    const d = deviceToDraft(
      device({
        status: 'Đã cấp phát',
        currentUser: { id: 7, fullName: 'Nguyễn Văn A', username: 'anv' },
        allocatedOn: '2026-10-01T00:00:00.000Z',
      }),
    );
    for (const key of ['currentUserId', 'allocated', 'allocatedOn', 'departmentId']) {
      expect(d).not.toHaveProperty(key);
    }
    expect(d.purchaseDate).toBe('');
  });
});
