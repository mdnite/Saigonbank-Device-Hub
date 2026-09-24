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
 * Quyền XEM đơn cấp phát/thu hồi: Quản trị viên, hoặc Trưởng phòng thuộc phòng Kỹ thuật.
 * Cùng điều kiện với DeviceWriteGuard nhưng khác domain (xem đơn, không phải ghi thiết bị) —
 * tách guard riêng để tên guard không gán nhầm ý nghĩa cho route /device-orders.
 * Phải chạy SAU AuthGuard — nó đọc req.user do AuthGuard gắn vào.
 */
@Injectable()
export class OrderAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    const allowed =
      user.roleName === ROLE.ADMIN ||
      (user.roleName === ROLE.HEAD &&
        user.departmentCode === TECH_DEPARTMENT_CODE);
    if (!allowed) throw new ForbiddenException(NO_PERMISSION);
    return true;
  }
}
