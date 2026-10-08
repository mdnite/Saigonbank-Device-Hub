import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department, Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { hashPassword } from '../../shared/security/password';
import { ROLE, roleAllowedFor } from '../identity/roles';
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
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) throw new BadRequestException('Vai trò không tồn tại');
    // `== null`: @IsOptional cho cả null lẫn undefined lọt qua DTO.
    const department =
      dto.departmentId == null
        ? null
        : await this.prisma.department.findUnique({
            where: { id: dto.departmentId },
          });
    if (dto.departmentId != null && !department) {
      throw new BadRequestException('Phòng ban không tồn tại');
    }
    if (!roleAllowedFor(role.roleName, department?.departmentCode ?? null)) {
      if (!department) throw new BadRequestException('Vui lòng chọn phòng ban');
      if (role.roleName === ROLE.ADMIN) {
        throw new BadRequestException('Quản trị viên không thuộc phòng ban');
      }
      throw new BadRequestException(
        `Phòng ${department.departmentName.replace(/^Phòng /, '')} không có chức vụ ${role.roleName}`,
      );
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
   *  SET NULL, không cần dọn tay. DeviceOrder/DeviceTransfer đều RESTRICT nhưng KHÔNG được
   *  dọn theo (đơn/lệnh là hồ sơ lịch sử) — id còn bị đơn/lệnh nào tham chiếu thì bị loại khỏi
   *  danh sách xoá và được trả về trong `skipped` kèm lý do; id không đủ status="Đã xóa" thì
   *  bị bỏ qua lặng lẽ. */
  async purge(ids: number[]) {
    return this.prisma.$transaction(async (tx) => {
      const referencedOrders = await tx.deviceOrder.findMany({
        where: {
          OR: [
            { targetUserId: { in: ids } },
            { createdById: { in: ids } },
            { decidedById: { in: ids } },
          ],
        },
        select: { targetUserId: true, createdById: true, decidedById: true },
      });
      const referencedTransfers = await tx.deviceTransfer.findMany({
        where: {
          OR: [
            { fromUserId: { in: ids } },
            { toUserId: { in: ids } },
            { createdById: { in: ids } },
            { decidedById: { in: ids } },
          ],
        },
        select: {
          fromUserId: true,
          toUserId: true,
          createdById: true,
          decidedById: true,
        },
      });
      // Kiểm kê: người lập / duyệt đợt, thành viên tham gia, người lập bảng tổng hợp — đều FK RESTRICT.
      const referencedAudits = await tx.audit.findMany({
        where: {
          OR: [{ createdById: { in: ids } }, { decidedById: { in: ids } }],
        },
        select: { createdById: true, decidedById: true },
      });
      const memberships = await tx.auditMember.findMany({
        where: { userId: { in: ids } },
        select: { userId: true },
      });
      const summaries = await tx.auditSummary.findMany({
        where: { createdById: { in: ids } },
        select: { createdById: true },
      });
      // id → lý do bị giữ lại, để Admin biết vì sao user không xoá được.
      const blocked = new Map<number, Set<string>>();
      const block = (id: number | null, reason: string) => {
        if (id === null) return;
        if (!blocked.has(id)) blocked.set(id, new Set());
        blocked.get(id)!.add(reason);
      };
      for (const o of referencedOrders)
        for (const id of [o.targetUserId, o.createdById, o.decidedById])
          block(id, 'đơn cấp phát - thu hồi');
      for (const t of referencedTransfers)
        for (const id of [
          t.fromUserId,
          t.toUserId,
          t.createdById,
          t.decidedById,
        ])
          block(id, 'lệnh điều chuyển');
      for (const a of referencedAudits) {
        block(a.createdById, 'đợt kiểm kê');
        block(a.decidedById, 'đợt kiểm kê');
      }
      for (const m of memberships) block(m.userId, 'đợt kiểm kê');
      for (const s of summaries) block(s.createdById, 'bảng tổng hợp kiểm kê');
      const purgeable = ids.filter((id) => !blocked.has(id));

      // Chỉ báo user thật sự nằm trong thùng rác; id chưa xoá mềm vẫn bị bỏ qua lặng lẽ.
      const kept = await tx.user.findMany({
        where: {
          id: { in: ids.filter((id) => blocked.has(id)) },
          status: USER_STATUS.DELETED,
        },
        select: { id: true, username: true, fullName: true },
      });
      const skipped = ids.flatMap((id) => {
        const u = kept.find((k) => k.id === id);
        return u ? [{ ...u, reasons: [...blocked.get(id)!] }] : [];
      });

      await tx.passwordResetToken.deleteMany({
        where: { userId: { in: purgeable } },
      });
      const { count } = await tx.user.deleteMany({
        where: { id: { in: purgeable }, status: USER_STATUS.DELETED },
      });
      return { count, skipped };
    });
  }

  roles() {
    return this.prisma.role.findMany({ orderBy: { id: 'asc' } });
  }

  /**
   * Danh sách rút gọn cho dropdown "Người sở hữu" của form thiết bị.
   * `activeOnly` (query `active=true`): chỉ user đang hoạt động, cho picker thành viên kiểm kê.
   * `select` chỉ 3 cột: đây KHÔNG phải cửa sau để đọc lại toàn bộ danh sách user.
   */
  userLookup(activeOnly = false) {
    return this.prisma.user.findMany({
      where: {
        status: activeOnly ? USER_STATUS.ACTIVE : { not: USER_STATUS.DELETED },
      },
      select: { id: true, fullName: true, username: true, departmentId: true },
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
