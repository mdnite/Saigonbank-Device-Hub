import { useAsyncData } from '@/shared/lib/useAsyncData';
import { deviceService } from '../infrastructure/container';

/** Danh mục cho form thiết bị: chỉ còn loại thiết bị (người giữ không chọn ở form nữa). */
export function useDeviceLookups() {
  const { data } = useAsyncData(() => deviceService.deviceTypes(), []);
  return { deviceTypes: data ?? [] };
}
