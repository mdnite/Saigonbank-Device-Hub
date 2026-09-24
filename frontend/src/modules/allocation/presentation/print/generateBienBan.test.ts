import { describe, expect, it } from 'vitest';
import type { DeviceOrderDetail } from '../../domain/deviceOrder';
import { buildBienBanContent } from './generateBienBan';

const device = (over: Partial<DeviceOrderDetail['items'][number]['device']> = {}) => ({
  id: 9,
  deviceCode: 'LT-000001',
  deviceName: 'Dell Latitude 5420',
  serialNumber: null,
  specDetail: 'i5 · 16GB',
  unit: 'Cái',
  status: 'Đã cấp phát',
  allocatedOn: null,
  location: null,
  purchaseDate: null,
  supplier: null,
  warrantyMonths: null,
  warrantyCondition: null,
  warrantyExpiresOn: null,
  deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' },
  department: null,
  currentUser: null,
  accessories: [],
  ...over,
});

const order = (over: Partial<DeviceOrderDetail> = {}): DeviceOrderDetail => ({
  id: 1,
  type: 'Cấp phát',
  status: 'Đã duyệt',
  note: null,
  rejectReason: null,
  decidedAt: '2026-09-24T00:00:00.000Z',
  createdAt: '2026-09-20T00:00:00.000Z',
  targetUser: { id: 5, fullName: 'Nguyễn Văn A', username: 'a' },
  createdBy: { id: 2, fullName: 'Trưởng phòng Kỹ thuật' },
  decidedBy: { id: 1, fullName: 'Quản trị viên' },
  deviceCount: 1,
  items: [{ id: 1, device: device() }],
  ...over,
});

describe('buildBienBanContent', () => {
  it('tiêu đề đúng theo loại đơn Cấp phát', () => {
    expect(buildBienBanContent(order())[0]).toBe('BIÊN BẢN CẤP PHÁT THIẾT BỊ');
  });

  it('tiêu đề đúng theo loại đơn Thu hồi', () => {
    expect(buildBienBanContent(order({ type: 'Thu hồi' }))[0]).toBe('BIÊN BẢN THU HỒI THIẾT BỊ');
  });

  it('liệt kê đúng mã thiết bị trong danh sách', () => {
    const lines = buildBienBanContent(order());
    expect(lines.some((l) => l.includes('LT-000001'))).toBe(true);
  });

  it('nhiều thiết bị: liệt kê đủ từng dòng', () => {
    const lines = buildBienBanContent(
      order({
        items: [
          { id: 1, device: device({ deviceCode: 'LT-000001' }) },
          { id: 2, device: device({ id: 10, deviceCode: 'LT-000002' }) },
        ],
      }),
    );
    expect(lines.some((l) => l.includes('LT-000001'))).toBe(true);
    expect(lines.some((l) => l.includes('LT-000002'))).toBe(true);
  });
});
