import { SetMetadata } from '@nestjs/common';
import { ROLE } from '../../modules/identity/roles';
import type { AuthUser } from './auth.guard';

export const TECH_DEPARTMENT_CODE = 'KYTHUAT';
export const ACCT_DEPARTMENT_CODE = 'KETOAN';

/** Một "vai" nghiệp vụ = role + (tuỳ chọn) phòng ban. */
export type Actor = (user: AuthUser) => boolean;

export const ACTOR = {
  ADMIN: (u) => u.roleName === ROLE.ADMIN,
  TECH_HEAD: (u) =>
    u.roleName === ROLE.HEAD && u.departmentCode === TECH_DEPARTMENT_CODE,
  TECH_COLLAB: (u) =>
    u.roleName === ROLE.COLLAB && u.departmentCode === TECH_DEPARTMENT_CODE,
  ACCT_HEAD: (u) =>
    u.roleName === ROLE.HEAD && u.departmentCode === ACCT_DEPARTMENT_CODE,
  ACCT_COLLAB: (u) =>
    u.roleName === ROLE.COLLAB && u.departmentCode === ACCT_DEPARTMENT_CODE,
} satisfies Record<string, Actor>;

export const ALLOW_KEY = 'allow';

/**
 * Chỉ user khớp ÍT NHẤT MỘT actor được gọi handler/controller. Dùng kèm @UseGuards(AuthGuard).
 * @Allow ở handler GHI ĐÈ (không cộng dồn) @Allow ở class.
 */
export const Allow = (...actors: Actor[]) => SetMetadata(ALLOW_KEY, actors);
