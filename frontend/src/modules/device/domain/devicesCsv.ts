import { toCsv } from '@/shared/lib/csv';
import type { Device } from './device';

const day = (s: string | null) => s?.slice(0, 10) ?? null;

/** Danh sách tài sản xuất CSV — đúng các dòng đang hiện trên /devices, không kèm linh kiện. */
export function devicesCsv(devices: Device[]): string {
  const header = [
    'Mã thiết bị',
    'Tên thiết bị',
    'Loại thiết bị',
    'Số serial',
    'Cấu hình',
    'Đơn vị tính',
    'Trạng thái',
    'Người sở hữu',
    'Ngày cấp phát',
    'Vị trí',
    'Ngày mua',
    'Nhà cung cấp',
    'Hạn bảo hành',
  ];
  return toCsv([
    header,
    ...devices.map((d) => [
      d.deviceCode,
      d.deviceName,
      d.deviceType.typeName,
      d.serialNumber,
      d.specDetail,
      d.unit,
      d.status,
      d.currentUser?.fullName,
      day(d.allocatedOn),
      d.location,
      day(d.purchaseDate),
      d.supplier,
      day(d.warrantyExpiresOn),
    ]),
  ]);
}
