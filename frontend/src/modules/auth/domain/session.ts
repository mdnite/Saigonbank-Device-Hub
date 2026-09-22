/** An authenticated user session. Produced by the login use-case, consumed app-wide. */
export interface AuthSession {
  userId: string;
  displayName: string;
  email: string;
  token: string;
  /** Role.RoleName từ backend, vd. "Quản trị viên". */
  roleName: string;
  /** Department.DepartmentCode của người dùng, null nếu không thuộc phòng ban nào. */
  departmentCode: string | null;
}

export const ADMIN_ROLE = 'Quản trị viên';
export const HEAD_ROLE = 'Trưởng phòng';
export const TECH_DEPARTMENT_CODE = 'KYTHUAT';

export const isAdmin = (session: AuthSession | null): boolean => session?.roleName === ADMIN_ROLE;

/** Ghi thiết bị: Quản trị viên, hoặc Trưởng phòng Kỹ thuật. Backend mới là chốt chặn thật. */
export const canWriteDevices = (session: AuthSession | null): boolean =>
  session?.roleName === ADMIN_ROLE ||
  (session?.roleName === HEAD_ROLE && session?.departmentCode === TECH_DEPARTMENT_CODE);

/** Đọc `exp` (giây) trong payload JWT. Token hỏng / thiếu exp coi như hết hạn. */
export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof exp !== 'number' || exp * 1000 <= now;
  } catch {
    return true;
  }
}
