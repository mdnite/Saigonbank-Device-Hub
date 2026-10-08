import { apiDelete, apiGet, apiPatch, apiPost } from '@/shared/lib/apiClient';
import type { PurgeResult, UserAdminRepository, UserQuery } from '../application/UserAdminRepository';
import { NO_DEPARTMENT, type Department, type NewUserDraft, type Role, type UserAccount, type UserStatus } from '../domain/userAccount';

/** Adapter gọi module `users` của backend (backend/src/modules/users). */
export class HttpUserAdminRepository implements UserAdminRepository {
  list({ search, status, roleId, departmentId }: UserQuery) {
    return apiGet<UserAccount[]>('/users', { search: search.trim(), status, roleId, departmentId });
  }

  create(d: NewUserDraft) {
    return apiPost<UserAccount>('/users', {
      username: d.username.trim(),
      fullName: d.fullName.trim(),
      email: d.email.trim().toLowerCase(),
      password: d.password,
      roleId: Number(d.roleId),
      departmentId:
        d.departmentId && d.departmentId !== NO_DEPARTMENT ? Number(d.departmentId) : undefined, // undefined bị JSON bỏ qua
    });
  }

  setStatus(id: number, status: Exclude<UserStatus, 'Đã xóa'>) {
    return apiPatch<UserAccount>(`/users/${id}/status`, { status });
  }

  async remove(id: number) {
    await apiDelete<null>(`/users/${id}`);
  }

  purge(ids: number[]) {
    return apiPost<PurgeResult>('/users/purge', { ids });
  }

  roles() {
    return apiGet<Role[]>('/roles');
  }

  departments() {
    return apiGet<Department[]>('/departments');
  }
}
