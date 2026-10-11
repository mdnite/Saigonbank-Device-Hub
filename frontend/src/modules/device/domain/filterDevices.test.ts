import { expect, it } from 'vitest';
import type { Device } from './device';
import { deviceLocations, EMPTY_DEVICE_FILTER, filterDevices } from './filterDevices';

const d = (id: number, over: Partial<Device>): Device =>
  ({
    id,
    deviceCode: `LT-00000${id}`,
    deviceName: 'Máy',
    serialNumber: null,
    location: null,
    deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' },
    ...over,
  }) as Device;

const devices = [
  d(1, { deviceName: 'Dell Latitude', serialNumber: 'ABC123', location: 'Tầng 2' }),
  d(2, { deviceCode: 'PC-000002', deviceName: 'HP ProDesk', deviceType: { id: 2, typeName: 'PC', prefix: 'PC' }, location: 'Tầng 3' }),
  d(3, { deviceName: 'Lenovo', location: null }),
];

it('bộ lọc rỗng: trả nguyên danh sách', () => {
  expect(filterDevices(devices, EMPTY_DEVICE_FILTER)).toEqual(devices);
});

it('tìm theo mã / tên / serial, không phân biệt hoa thường, bỏ khoảng trắng 2 đầu', () => {
  const ids = (search: string) => filterDevices(devices, { ...EMPTY_DEVICE_FILTER, search }).map((x) => x.id);
  expect(ids('pc-0000')).toEqual([2]);
  expect(ids('  dell ')).toEqual([1]);
  expect(ids('abc')).toEqual([1]);
});

it('lọc loại + vị trí kết hợp', () => {
  expect(filterDevices(devices, { search: '', typeId: 1, location: 'Tầng 2' }).map((x) => x.id)).toEqual([1]);
  expect(filterDevices(devices, { search: '', typeId: 2, location: 'Tầng 2' })).toEqual([]);
});

it('deviceLocations: distinct, bỏ null, sắp xếp', () => {
  expect(deviceLocations([...devices, d(4, { location: 'Tầng 2' })])).toEqual(['Tầng 2', 'Tầng 3']);
});
