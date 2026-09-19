import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Chỉ các role (RoleName) liệt kê được gọi handler/controller. Dùng kèm @UseGuards(AuthGuard). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
