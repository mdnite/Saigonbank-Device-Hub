import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { USER_STATUS } from '../../modules/identity/user-status';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';

export interface JwtPayload {
  userId: number;
  roleId: number;
}

export interface AuthUser {
  id: number;
  roleName: string;
}

export type AuthedRequest = Request & { user: AuthUser };

const SESSION_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';

/**
 * Verify JWT rồi đọc lại User + Role từ DB mỗi request: khoá / xoá / đổi role có hiệu lực ngay
 * mà vẫn không cần bảng session (JWT stateless đã chốt).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });
    if (!user || user.status !== USER_STATUS.ACTIVE) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const allowed = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed && !allowed.includes(user.role.roleName)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    req.user = { id: user.id, roleName: user.role.roleName };
    return true;
  }
}
