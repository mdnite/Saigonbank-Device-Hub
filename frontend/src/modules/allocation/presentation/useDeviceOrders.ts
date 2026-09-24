import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { DeviceOrderQuery } from '../application/DeviceOrderRepository';
import { deviceOrderService } from '../infrastructure/container';

export function useDeviceOrders(query: DeviceOrderQuery, reloadKey = 0) {
  return useAsyncData(() => deviceOrderService.list(query), [query.type, query.status, reloadKey]);
}
