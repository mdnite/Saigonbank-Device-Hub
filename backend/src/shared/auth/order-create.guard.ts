import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ROLE } from '../../modules/identity/roles';
import type { AuthedRequest } from './auth.guard';
import { TECH_DEPARTMENT_CODE } from './device-write.guard';

const NO_PERMISSION = 'Bạn không có quyền thực hiện thao tác này';

/**
 * Quyền TẠO đơn: chỉ Trưởng phòng thuộc phòng Kỹ thuật — KHÔNG gồm Quản trị viên
 * (khác DeviceWriteGuard). Quản trị viên chỉ duyệt/từ chối, xem device-orders.controller.ts.
 */
@Injectable()
export class OrderCreateGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    const allowed = user.roleName === ROLE.HEAD && user.departmentCode === TECH_DEPARTMENT_CODE;
    if (!allowed) throw new ForbiddenException(NO_PERMISSION);
    return true;
  }
}
