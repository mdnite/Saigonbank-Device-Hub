import { apiGet, apiPatch, apiPost } from '@/shared/lib/apiClient';
import type { DeviceOrder, DeviceOrderDetail, UserRef } from '../domain/deviceOrder';
import type { OrderDraft } from '../domain/validateOrderDraft';
import type { DeviceOrderQuery, DeviceOrderRepository } from '../application/DeviceOrderRepository';

function toBody(d: OrderDraft) {
  return {
    type: d.type,
    targetUserId: d.targetUserId ?? undefined,
    note: d.note.trim() ? d.note.trim() : undefined,
    deviceIds: d.deviceIds,
  };
}

/** Adapter gọi module `device-orders` của backend (backend/src/modules/device-orders). */
export class HttpDeviceOrderRepository implements DeviceOrderRepository {
  list(query: DeviceOrderQuery = {}): Promise<DeviceOrder[]> {
    return apiGet<DeviceOrder[]>('/device-orders', query as Record<string, string | number | undefined>);
  }
  getById(id: number): Promise<DeviceOrderDetail> {
    return apiGet<DeviceOrderDetail>(`/device-orders/${id}`);
  }
  create(draft: OrderDraft): Promise<DeviceOrderDetail> {
    return apiPost<DeviceOrderDetail>('/device-orders', toBody(draft));
  }
  approve(id: number): Promise<DeviceOrderDetail> {
    return apiPatch<DeviceOrderDetail>(`/device-orders/${id}/approve`, undefined);
  }
  reject(id: number, reason: string): Promise<DeviceOrderDetail> {
    return apiPatch<DeviceOrderDetail>(`/device-orders/${id}/reject`, { reason });
  }
  users(): Promise<UserRef[]> {
    return apiGet<UserRef[]>('/users/lookup');
  }
}
