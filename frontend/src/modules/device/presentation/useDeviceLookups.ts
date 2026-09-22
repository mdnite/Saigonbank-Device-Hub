import { useAsyncData } from '@/shared/lib/useAsyncData';
import { deviceService } from '../infrastructure/container';

/**
 * Danh mục cho form thiết bị: loại thiết bị, phòng ban, người sở hữu.
 * Cả 3 endpoint (/device-types, /departments, /users/lookup) chỉ cần đã đăng nhập,
 * nên Trưởng phòng Kỹ thuật cũng chọn được người sở hữu như Quản trị viên.
 */
export function useDeviceLookups() {
  const { data } = useAsyncData(
    () =>
      Promise.all([
        deviceService.deviceTypes(),
        deviceService.departments(),
        deviceService.users(),
      ]),
    [],
  );
  return {
    deviceTypes: data?.[0] ?? [],
    departments: data?.[1] ?? [],
    users: data?.[2] ?? [],
  };
}
