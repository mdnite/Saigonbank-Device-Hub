import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { UserQuery } from '@/modules/user/application/UserAdminRepository';
import { userAdminService } from '@/modules/user/infrastructure/container';
import { deviceService } from '../infrastructure/container';

const ALL_USERS: UserQuery = { search: '', status: '', roleId: '', departmentId: '' };

/**
 * Danh mục cho form thiết bị: loại thiết bị, phòng ban, người sở hữu.
 * GET /users chỉ Quản trị viên gọi được — người dùng khác nhận 403, dropdown rỗng thay vì vỡ trang.
 */
export function useDeviceLookups() {
  const { data } = useAsyncData(
    () =>
      Promise.all([
        deviceService.deviceTypes(),
        userAdminService.departments(),
        userAdminService.list(ALL_USERS).catch(() => []),
      ]),
    [],
  );
  return {
    deviceTypes: data?.[0] ?? [],
    departments: data?.[1] ?? [],
    users: data?.[2] ?? [],
  };
}
