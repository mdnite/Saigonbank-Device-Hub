import {
  validateNewUser,
  type Department,
  type NewUserDraft,
  type Role,
  type UserAccount,
  type UserStatus,
} from '../domain/userAccount';

/** Bộ lọc danh sách; '' = tất cả. */
export interface UserQuery {
  search: string;
  status: string;
  roleId: string;
  departmentId: string;
}

/** Kết quả dọn thùng rác: user còn bị đơn/lệnh/kiểm kê tham chiếu thì bị giữ lại kèm lý do. */
export interface PurgeResult {
  count: number;
  skipped: Array<{ id: number; username: string; fullName: string; reasons: string[] }>;
}

export interface UserAdminRepository {
  list(query: UserQuery): Promise<UserAccount[]>;
  create(draft: NewUserDraft): Promise<UserAccount>;
  setStatus(id: number, status: Exclude<UserStatus, 'Đã xóa'>): Promise<UserAccount>;
  /** Xoá mềm — backend chỉ đổi Status thành "Đã xóa". */
  remove(id: number): Promise<void>;
  /** Xoá cứng hàng loạt (dọn thùng rác) — chỉ xoá được user đã ở Status "Đã xóa". */
  purge(ids: number[]): Promise<PurgeResult>;
  roles(): Promise<Role[]>;
  departments(): Promise<Department[]>;
}

export class UserAdminValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'UserAdminValidationError';
  }
}

export function makeUserAdminService(repo: UserAdminRepository) {
  return {
    list: (query: UserQuery) => repo.list(query),
    create: (draft: NewUserDraft) => {
      const errors = validateNewUser(draft);
      if (Object.keys(errors).length) throw new UserAdminValidationError(errors as Record<string, string>);
      return repo.create(draft);
    },
    setStatus: (id: number, status: Exclude<UserStatus, 'Đã xóa'>) => repo.setStatus(id, status),
    remove: (id: number) => repo.remove(id),
    purge: (ids: number[]) => repo.purge(ids),
    roles: () => repo.roles(),
    departments: () => repo.departments(),
  };
}

export type UserAdminService = ReturnType<typeof makeUserAdminService>;
