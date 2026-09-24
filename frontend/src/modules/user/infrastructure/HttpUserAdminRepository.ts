import { apiDelete, apiGet, apiPatch, apiPost } from '@/shared/lib/apiClient';
import type { UserAdminRepository, UserQuery } from '../application/UserAdminRepository';
import type { Department, NewUserDraft, Role, UserAccount, UserStatus } from '../domain/userAccount';

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
      departmentId: d.departmentId ? Number(d.departmentId) : undefined, // undefined bị JSON bỏ qua
    });
  }

  setStatus(id: number, status: Exclude<UserStatus, 'Đã xóa'>) {
    return apiPatch<UserAccount>(`/users/${id}/status`, { status });
  }

  async remove(id: number) {
    await apiDelete<null>(`/users/${id}`);
  }

  async purge(ids: number[]): Promise<number> {
    const res = await apiPost<{ count: number }>('/users/purge', { ids });
    return res.count;
  }

  roles() {
    return apiGet<Role[]>('/roles');
  }

  departments() {
    return apiGet<Department[]>('/departments');
  }
}
