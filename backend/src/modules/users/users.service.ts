import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department, Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { hashPassword } from '../../shared/security/password';
import { USER_STATUS } from '../identity/user-status';
import { CreateUserDto, ListUsersQuery, MAX_INT32 } from './users.dto';

export const USER_NOT_FOUND = 'Người dùng không tồn tại';
const WITH_RELATIONS = { role: true, department: true } as const;

type UserWithRelations = User & { role: Role; department: Department | null };

/** Shape trả cho FE — không bao giờ có password. */
function toListItem(u: UserWithRelations) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    status: u.status,
    isVerified: u.isVerified,
    createdAt: u.createdAt,
    role: { id: u.role.id, roleName: u.role.roleName },
    department: u.department && {
      id: u.department.id,
      departmentCode: u.department.departmentCode,
      departmentName: u.department.departmentName,
    },
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ponytail: không phân trang (DataTable FE cũng chưa có) — thêm skip/take khi số user đủ lớn.
  async list({ search, status, roleId, departmentId }: ListUsersQuery) {
    const q = search?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        status: status ?? { not: USER_STATUS.DELETED },
        roleId,
        departmentId,
        ...(q
          ? {
              OR: [
                {
                  username: { contains: q, mode: Prisma.QueryMode.insensitive },
                },
                {
                  fullName: { contains: q, mode: Prisma.QueryMode.insensitive },
                },
                { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
      include: WITH_RELATIONS,
      orderBy: { id: 'asc' },
    });
    return users.map(toListItem);
  }

  // Lưu ý: user "Đã xóa" vẫn giữ username/email (unique) → không tạo lại được cùng email.
  async create(dto: CreateUserDto) {
    if (
      await this.prisma.user.findUnique({ where: { username: dto.username } })
    ) {
      throw new ConflictException('Tên đăng nhập đã tồn tại');
    }
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) {
      throw new ConflictException('Email đã tồn tại');
    }
    if (!(await this.prisma.role.findUnique({ where: { id: dto.roleId } }))) {
      throw new BadRequestException('Vai trò không tồn tại');
    }
    if (
      dto.departmentId !== undefined &&
      !(await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      }))
    ) {
      throw new BadRequestException('Phòng ban không tồn tại');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          fullName: dto.fullName,
          password: await hashPassword(dto.password),
          roleId: dto.roleId,
          departmentId: dto.departmentId ?? null,
          status: USER_STATUS.ACTIVE,
          isVerified: false, // chuyển true khi user tự đặt lại mật khẩu qua OTP
        },
        include: WITH_RELATIONS,
      });
      return toListItem(user);
    } catch (e) {
      // 2 request tạo cùng lúc lọt qua kiểm tra trên → DB unique chặn.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Tên đăng nhập hoặc email đã tồn tại');
      }
      throw e;
    }
  }

  async updateStatus(actorId: number, id: number, status: string) {
    if (actorId === id) {
      throw new BadRequestException('Không thể tự khoá tài khoản của mình');
    }
    await this.findLiveUser(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      include: WITH_RELATIONS,
    });
    return toListItem(user);
  }

  /** Xoá mềm (UC-06): chỉ đổi Status, không bao giờ xoá row. */
  async softDelete(actorId: number, id: number): Promise<void> {
    if (actorId === id) {
      throw new BadRequestException('Không thể tự xoá tài khoản của mình');
    }
    await this.findLiveUser(id);
    await this.prisma.user.update({
      where: { id },
      data: { status: USER_STATUS.DELETED },
    });
  }

  /** Dọn thùng rác: xoá cứng — chỉ những id đã ở Status "Đã xóa", id khác bị bỏ qua.
   *  PasswordResetToken.userId là RESTRICT (khác DeviceAccessory là CASCADE của thiết bị)
   *  nên phải xoá token của các user này trước, không thì DB chặn. Device.currentUserId là
   *  SET NULL, không cần dọn tay. */
  async purge(ids: number[]): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { userId: { in: ids } },
      });
      const { count } = await tx.user.deleteMany({
        where: { id: { in: ids }, status: USER_STATUS.DELETED },
      });
      return count;
    });
  }

  roles() {
    return this.prisma.role.findMany({ orderBy: { id: 'asc' } });
  }

  /**
   * Danh sách rút gọn cho dropdown "Người sở hữu" của form thiết bị.
   * `select` chỉ 3 cột: đây KHÔNG phải cửa sau để đọc lại toàn bộ danh sách user.
   */
  userLookup() {
    return this.prisma.user.findMany({
      where: { status: { not: USER_STATUS.DELETED } },
      select: { id: true, fullName: true, username: true },
      orderBy: { id: 'asc' },
    });
  }

  departments() {
    return this.prisma.department.findMany({ orderBy: { id: 'asc' } });
  }

  private async findLiveUser(id: number) {
    // Id ngoài phạm vi int4: Prisma ném lỗi (500) — coi như người dùng không tồn tại.
    if (Math.abs(id) > MAX_INT32) throw new NotFoundException(USER_NOT_FOUND);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.status === USER_STATUS.DELETED) {
      throw new NotFoundException(USER_NOT_FOUND);
    }
    return user;
  }
}
