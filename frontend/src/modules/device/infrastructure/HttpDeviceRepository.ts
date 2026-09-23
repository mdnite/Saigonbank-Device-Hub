import { apiDelete, apiGet, apiPatch, apiPost } from '@/shared/lib/apiClient';
import type { DepartmentRef, Device, DeviceTypeRef, UserRef } from '../domain/device';
import type { DeviceDraft } from '../domain/deviceDraft';
import type { DeviceQuery, DeviceRepository } from '../application/DeviceRepository';

/** Draft (dạng form, chuỗi rỗng = chưa nhập) → body API (bỏ hẳn trường rỗng). */
export function toBody(d: DeviceDraft) {
  const text = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    deviceCode: d.deviceCode.trim().toUpperCase(),
    deviceName: d.deviceName.trim(),
    specDetail: d.specDetail.trim(),
    unit: d.unit.trim(),
    deviceTypeId: d.deviceTypeId ?? undefined,
    serialNumber: text(d.serialNumber),
    location: text(d.location),
    purchaseDate: text(d.purchaseDate),
    supplier: text(d.supplier),
    warrantyMonths: d.warrantyMonths.trim() ? Number(d.warrantyMonths) : undefined,
    warrantyCondition: text(d.warrantyCondition),
    warrantyExpiresOn: text(d.warrantyExpiresOn),
    departmentId: d.departmentId ?? undefined,
    currentUserId: d.allocated ? (d.currentUserId ?? undefined) : undefined,
    allocatedOn: d.allocated ? text(d.allocatedOn) : undefined,
    accessories: d.accessories,
  };
}

/** Adapter gọi module `devices` của backend (backend/src/modules/devices). */
export class HttpDeviceRepository implements DeviceRepository {
  list(query: DeviceQuery = {}): Promise<Device[]> {
    return apiGet<Device[]>('/devices', query as Record<string, string | number | undefined>);
  }
  getById(id: number): Promise<Device> {
    return apiGet<Device>(`/devices/${id}`);
  }
  create(draft: DeviceDraft): Promise<Device> {
    return apiPost<Device>('/devices', toBody(draft));
  }
  update(id: number, draft: DeviceDraft): Promise<Device> {
    return apiPatch<Device>(`/devices/${id}`, toBody(draft));
  }
  async remove(id: number): Promise<void> {
    await apiDelete<null>(`/devices/${id}`);
  }
  async purge(ids: number[]): Promise<number> {
    const res = await apiPost<{ count: number }>('/devices/purge', { ids });
    return res.count;
  }
  deviceTypes(): Promise<DeviceTypeRef[]> {
    return apiGet<DeviceTypeRef[]>('/device-types');
  }
  departments(): Promise<DepartmentRef[]> {
    return apiGet<DepartmentRef[]>('/departments');
  }
  /** /users/lookup chứ không phải /users: GET /users chỉ Quản trị viên gọi được. */
  users(): Promise<UserRef[]> {
    return apiGet<UserRef[]>('/users/lookup');
  }
}
