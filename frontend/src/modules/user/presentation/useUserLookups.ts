import { useAsyncData } from '@/shared/lib/useAsyncData';
import { userAdminService } from '../infrastructure/container';

/** Danh mục role + phòng ban cho dropdown lọc và form tạo. */
export function useUserLookups() {
  const { data } = useAsyncData(
    () => Promise.all([userAdminService.roles(), userAdminService.departments()]),
    [],
  );
  return { roles: data?.[0] ?? [], departments: data?.[1] ?? [] };
}
