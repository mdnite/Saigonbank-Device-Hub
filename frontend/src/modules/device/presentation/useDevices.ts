import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { DeviceQuery } from '../application/DeviceRepository';
import { deviceService } from '../infrastructure/container';

/** `reloadKey` đổi giá trị để buộc nạp lại sau khi xoá/sửa — theo cách UserListPage đang làm. */
export function useDevices(query: DeviceQuery, reloadKey = 0) {
  return useAsyncData(() => deviceService.list(query), [query.search, query.status, reloadKey]);
}
