import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { DeviceTransferQuery } from '../application/DeviceTransferRepository';
import { deviceTransferService } from '../infrastructure/container';

export function useDeviceTransfers(query: DeviceTransferQuery, reloadKey = 0) {
  return useAsyncData(() => deviceTransferService.list(query), [query.status, reloadKey]);
}
