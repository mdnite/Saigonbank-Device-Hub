import { apiGet, apiPatch, apiPost } from '@/shared/lib/apiClient';
import type { DeviceTransfer, DeviceTransferDetail, UserRef } from '../domain/deviceTransfer';
import type { TransferDraft } from '../domain/validateTransferDraft';
import type { DeviceTransferQuery, DeviceTransferRepository } from '../application/DeviceTransferRepository';

function toBody(d: TransferDraft) {
  return {
    fromUserId: d.fromUserId ?? undefined,
    toUserId: d.toUserId ?? undefined,
    note: d.note.trim() ? d.note.trim() : undefined,
    deviceIds: d.deviceIds,
  };
}

/** Adapter gọi module `device-transfers` của backend (backend/src/modules/device-transfers). */
export class HttpDeviceTransferRepository implements DeviceTransferRepository {
  list(query: DeviceTransferQuery = {}): Promise<DeviceTransfer[]> {
    return apiGet<DeviceTransfer[]>(
      '/device-transfers',
      query as Record<string, string | number | undefined>,
    );
  }
  getById(id: number): Promise<DeviceTransferDetail> {
    return apiGet<DeviceTransferDetail>(`/device-transfers/${id}`);
  }
  create(draft: TransferDraft): Promise<DeviceTransferDetail> {
    return apiPost<DeviceTransferDetail>('/device-transfers', toBody(draft));
  }
  approve(id: number): Promise<DeviceTransferDetail> {
    return apiPatch<DeviceTransferDetail>(`/device-transfers/${id}/approve`, undefined);
  }
  reject(id: number, reason: string): Promise<DeviceTransferDetail> {
    return apiPatch<DeviceTransferDetail>(`/device-transfers/${id}/reject`, { reason });
  }
  users(): Promise<UserRef[]> {
    return apiGet<UserRef[]>('/users/lookup');
  }
}
