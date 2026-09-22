import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../../shared/auth/auth.guard';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { comparePassword } from '../../shared/security/password';
import { LoginDto } from './auth.dto';
import { USER_STATUS } from './user-status';

const INVALID_CREDENTIALS = 'Sai tên đăng nhập hoặc mật khẩu';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ identifier, password }: LoginDto) {
    const id = identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: id }, { email: id }] },
      include: { role: true },
    });

    // "Đã xóa" trả y hệt tài khoản không tồn tại — không lộ việc tài khoản từng tồn tại.
    if (!user || user.status === USER_STATUS.DELETED) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    // Kiểm mật khẩu trước khi báo khoá, để người không biết mật khẩu không dò được tài khoản nào đang bị khoá.
    if (!(await comparePassword(password, user.password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (user.status !== USER_STATUS.ACTIVE) {
      throw new ForbiddenException('Tài khoản đã bị khoá');
    }

    const payload: JwtPayload = { userId: user.id, roleId: user.roleId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        roleId: user.roleId,
        roleName: user.role.roleName,
        departmentId: user.departmentId,
        status: user.status,
        isVerified: user.isVerified,
      },
    };
  }
}
