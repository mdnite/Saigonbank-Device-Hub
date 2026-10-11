import { expect, it } from 'vitest';
import type { Device } from './device';
import { devicesCsv } from './devicesCsv';

const device = {
  id: 1,
  deviceCode: 'LT-000001',
  deviceName: 'Dell, Latitude',
  serialNumber: null,
  specDetail: 'i5',
  unit: 'Cái',
  status: 'Đã cấp phát',
  allocatedOn: '2026-09-01T00:00:00.000Z',
  location: 'Tầng 2',
  purchaseDate: '2026-01-15',
  supplier: 'FPT',
  warrantyMonths: 24,
  warrantyCondition: null,
  warrantyExpiresOn: '2028-01-15',
  deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' },
  currentUser: { id: 5, fullName: 'Nguyễn Văn A', username: 'a' },
  accessories: [],
} as Device;

it('header + 1 dòng, ngày cắt 10 ký tự, null thành ô trống, có dấu phẩy thì bọc nháy', () => {
  const lines = devicesCsv([device]).replace('\uFEFF', '').split('\r\n');
  expect(lines[0]).toBe(
    'Mã thiết bị,Tên thiết bị,Loại thiết bị,Số serial,Cấu hình,Đơn vị tính,Trạng thái,Người sở hữu,Ngày cấp phát,Vị trí,Ngày mua,Nhà cung cấp,Hạn bảo hành',
  );
  expect(lines[1]).toBe(
    'LT-000001,"Dell, Latitude",Laptop,,i5,Cái,Đã cấp phát,Nguyễn Văn A,2026-09-01,Tầng 2,2026-01-15,FPT,2028-01-15',
  );
});

it('máy không có người sở hữu: ô trống', () => {
  const lines = devicesCsv([{ ...device, currentUser: null, allocatedOn: null }]).split('\r\n');
  expect(lines[1]).toContain(',Đã cấp phát,,,Tầng 2,');
});
