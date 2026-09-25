import { describe, expect, it } from 'vitest';
import type { Device } from '@/modules/device/domain/device';
import type { DeviceTransferDetail } from '../../domain/deviceTransfer';
import { buildBienBanContent } from './generateBienBan';

const device = (over: Partial<Device> = {}): Device => ({
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

const transfer = (over: Partial<DeviceTransferDetail> = {}): DeviceTransferDetail => ({
  id: 1,
  status: 'Đã duyệt',
  note: null,
  rejectReason: null,
  decidedAt: '2026-09-25T00:00:00.000Z',
  createdAt: '2026-09-24T00:00:00.000Z',
  fromUser: { id: 5, fullName: 'Nhân viên A', username: 'a' },
  toUser: { id: 6, fullName: 'Nhân viên B', username: 'b' },
  createdBy: { id: 1, fullName: 'Quản trị viên' },
  decidedBy: { id: 2, fullName: 'Trưởng phòng Kỹ thuật' },
  deviceCount: 1,
  items: [{ id: 1, device: device() }],
  ...over,
});

describe('buildBienBanContent (transfer)', () => {
  it('tiêu đề đúng', () => {
    expect(buildBienBanContent(transfer())[0]).toBe('BIÊN BẢN ĐIỀU CHUYỂN THIẾT BỊ');
  });

  it('có tên người giao và người nhận', () => {
    const lines = buildBienBanContent(transfer());
    expect(lines.some((l) => l.includes('Nhân viên A'))).toBe(true);
    expect(lines.some((l) => l.includes('Nhân viên B'))).toBe(true);
  });

  it('liệt kê đúng mã thiết bị trong danh sách', () => {
    const lines = buildBienBanContent(transfer());
    expect(lines.some((l) => l.includes('LT-000001'))).toBe(true);
  });

  it('nhiều thiết bị: liệt kê đủ từng dòng', () => {
    const lines = buildBienBanContent(
      transfer({
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
