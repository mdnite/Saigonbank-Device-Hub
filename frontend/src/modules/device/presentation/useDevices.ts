import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { DeviceQuery } from '../application/DeviceRepository';
import { deviceService } from '../infrastructure/container';

export function useDevices(query: DeviceQuery) {
  return useAsyncData(() => deviceService.list(query), [query.search, query.status]);
}
