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
export const SPECIALIST_ROLE = 'Chuyên viên';
export const TECH_DEPARTMENT_CODE = 'KYTHUAT';
export const ACCT_DEPARTMENT_CODE = 'KETOAN';

// Backend mới là chốt chặn thật (backend/src/shared/auth/actors.ts) — các hàm dưới chỉ để ẩn/hiện UI.
export type Can = (session: AuthSession | null) => boolean;

export const isAdmin: Can = (session) => session?.roleName === ADMIN_ROLE;

export const isTechHead: Can = (session) =>
  session?.roleName === HEAD_ROLE && session?.departmentCode === TECH_DEPARTMENT_CODE;

export const isTechSpecialist: Can = (session) =>
  session?.roleName === SPECIALIST_ROLE && session?.departmentCode === TECH_DEPARTMENT_CODE;

const isTechTeam: Can = (session) => isTechHead(session) || isTechSpecialist(session);
const isAdminOrTechTeam: Can = (session) => isAdmin(session) || isTechTeam(session);

/** Thêm/sửa thông tin thiết bị: Trưởng phòng Kỹ thuật hoặc Chuyên viên Kỹ thuật. */
export const canWriteDevices = isTechTeam;

/** Xoá mềm + dọn thùng rác thiết bị: CHỈ Trưởng phòng Kỹ thuật. */
export const canDeleteDevices = isTechHead;

/** Xem đơn Cấp phát - Thu hồi: Quản trị viên (chỉ xem), Trưởng phòng và Chuyên viên Kỹ thuật. */
export const canAccessOrders = isAdminOrTechTeam;

/** Tạo đơn: CHỈ Chuyên viên Kỹ thuật. */
export const canCreateOrder = isTechSpecialist;

/** Duyệt/từ chối đơn: CHỈ Trưởng phòng Kỹ thuật. */
export const canDecideOrder = isTechHead;

/** Xem lệnh Điều chuyển: cùng tập với canAccessOrders. */
export const canAccessTransfers = isAdminOrTechTeam;

/** Tạo lệnh điều chuyển: CHỈ Chuyên viên Kỹ thuật. */
export const canCreateTransfer = isTechSpecialist;

/** Duyệt/từ chối lệnh điều chuyển: CHỈ Trưởng phòng Kỹ thuật. */
export const canDecideTransfer = isTechHead;

export const isAcctHead: Can = (session) =>
  session?.roleName === HEAD_ROLE && session?.departmentCode === ACCT_DEPARTMENT_CODE;

export const isAcctSpecialist: Can = (session) =>
  session?.roleName === SPECIALIST_ROLE && session?.departmentCode === ACCT_DEPARTMENT_CODE;

/** Kiểm kê: CHỈ Trưởng phòng và Chuyên viên Kế toán — Admin và Kỹ thuật không thấy. */
export const canAccessAudits: Can = (session) => isAcctHead(session) || isAcctSpecialist(session);

/** Lập lịch, nhập kết quả, gửi duyệt, lập bảng tổng hợp: CHỈ Chuyên viên Kế toán. */
export const canCreateAudit = isAcctSpecialist;

/** Duyệt / từ chối kết quả kiểm kê: CHỈ Trưởng phòng Kế toán. */
export const canDecideAudit = isAcctHead;

/** "Tìm thấy" thiết bị Thất lạc: CHỈ Trưởng phòng Kỹ thuật. */
export const canMarkDeviceFound = isTechHead;

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
