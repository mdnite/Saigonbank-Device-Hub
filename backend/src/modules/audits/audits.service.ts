import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DEVICE_STATUS } from '../devices/device-status';
import { DEVICE_WITH_RELATIONS } from '../devices/devices.service';
import { USER_STATUS } from '../identity/user-status';
import { MAX_INT32 } from '../users/users.dto';
import {
  AUDIT_NOT_FOUND,
  AUDIT_RESULT,
  AUDIT_STATUS,
  AUDIT_WRONG_STATE,
  DELETABLE_AUDIT_STATUSES,
  devicesChanged,
  LINE_NOT_FOUND,
  OPEN_AUDIT_STATUSES,
  WAREHOUSE_UNIT_NAME,
} from './audit-status';
import type {
  CreateAuditDto,
  ListAuditsQuery,
  UpdateAuditLineDto,
} from './audits.dto';

export const DETAIL_INCLUDE = {
  createdBy: true,
  decidedBy: true,
  deviceType: true,
  members: { include: { user: true } },
  items: { include: { accessories: true }, orderBy: { id: 'asc' } },
} as const;

type AuditWithRelations = Prisma.AuditGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

type Line = { result: string | null };

/** Số dòng phải đếm (thiết bị + linh kiện) và số dòng đã có kết quả. */
export function countLines(items: (Line & { accessories: Line[] })[]) {
  const lines = items.flatMap((i) => [i, ...i.accessories]);
  return {
    totalLines: lines.length,
    countedLines: lines.filter((l) => l.result !== null).length,
  };
}

function toListItem(a: AuditWithRelations) {
  return {
    id: a.id,
    status: a.status,
    departmentId: a.departmentId,
    unitName: a.unitName,
    dueDate: a.dueDate,
    purpose: a.purpose,
    deviceTypeName: a.deviceType?.typeName ?? null,
    location: a.location,
    rejectReason: a.rejectReason,
    createdAt: a.createdAt,
    startedAt: a.startedAt,
    submittedAt: a.submittedAt,
    decidedAt: a.decidedAt,
    createdBy: { id: a.createdBy.id, fullName: a.createdBy.fullName },
    decidedBy: a.decidedBy && {
      id: a.decidedBy.id,
      fullName: a.decidedBy.fullName,
    },
    deviceCount: a.items.length,
    ...countLines(a.items),
  };
}

function toDetail(a: AuditWithRelations) {
  return {
    ...toListItem(a),
    members: a.members.map((m) => ({
      id: m.user.id,
      fullName: m.user.fullName,
      username: m.user.username,
    })),
    items: a.items.map((i) => ({
      id: i.id,
      deviceId: i.deviceId,
      deviceCode: i.deviceCode,
      deviceName: i.deviceName,
      serialNumber: i.serialNumber,
      deviceTypeName: i.deviceTypeName,
      unit: i.unit,
      holderName: i.holderName,
      departmentName: i.departmentName,
      deviceStatus: i.deviceStatus,
      result: i.result,
      note: i.note,
      accessories: i.accessories.map((x) => ({
        id: x.id,
        accessoryCode: x.accessoryCode,
        accessoryName: x.accessoryName,
        accessoryType: x.accessoryType,
        unit: x.unit,
        result: x.result,
        note: x.note,
      })),
    })),
  };
}

@Injectable()
export class AuditsService {
  constructor(private readonly prisma: PrismaService) {}

  // ponytail: đọc đủ items chỉ để đếm tiến độ, chưa phân trang — đổi sang _count khi nhiều đợt.
  async list(q: ListAuditsQuery) {
    const s = q.q?.trim();
    const audits = await this.prisma.audit.findMany({
      where: {
        // Thùng rác chỉ hiện khi lọc đúng "Đã xóa".
        status: q.status ?? { not: AUDIT_STATUS.DELETED },
        ...(s
          ? {
              OR: [
                {
                  unitName: {
                    contains: s,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  purpose: {
                    contains: s,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            }
          : {}),
      },
      include: DETAIL_INCLUDE,
      orderBy: { id: 'desc' },
    });
    return audits.map(toListItem);
  }

  async getById(id: number) {
    return toDetail(await this.findAudit(id));
  }

  /** Giá trị Device.location đang dùng — cho dropdown "Vị trí thiết bị" (cột là text tự do). */
  async locations(): Promise<string[]> {
    const rows = await this.prisma.device.findMany({
      where: {
        status: { not: DEVICE_STATUS.DELETED },
        location: { not: null },
      },
      select: { location: true },
    });
    return [...new Set(rows.map((r) => r.location!))].sort((a, b) =>
      a.localeCompare(b, 'vi'),
    );
  }

  async create(dto: CreateAuditDto, createdById: number) {
    const department =
      dto.departmentId === null
        ? null
        : await this.requireDepartment(dto.departmentId);
    const devices = await this.findDevicesInScope(dto, department?.id ?? null);
    if (devices.length === 0) {
      throw new BadRequestException('Không có thiết bị nào khớp bộ lọc');
    }
    await this.requireNotInOpenAudit(devices.map((d) => d.id));
    const memberIds = dto.memberIds ?? [];
    await this.requireActiveUsers(memberIds);

    // ponytail: kiểm tra trùng đợt rồi mới tạo (2 câu lệnh) — 2 người lập lịch trùng máy đúng cùng
    // lúc có thể lọt cả hai. Thêm khoá (SELECT … FOR UPDATE) nếu có nhiều Chuyên viên lập lịch song song.
    const audit = await this.prisma.audit.create({
      data: {
        departmentId: department?.id ?? null,
        unitName: department?.departmentName ?? WAREHOUSE_UNIT_NAME,
        dueDate: new Date(dto.dueDate),
        purpose: dto.purpose,
        deviceTypeId: dto.deviceTypeId ?? null,
        location: dto.location ?? null,
        createdById,
        items: {
          create: devices.map((d) => ({
            deviceId: d.id,
            deviceCode: d.deviceCode,
            deviceName: d.deviceName,
            serialNumber: d.serialNumber,
            deviceTypeName: d.deviceType.typeName,
            unit: d.unit,
            holderUserId: d.currentUserId,
            holderName: d.currentUser?.fullName ?? null,
            departmentName: department?.departmentName ?? null,
            deviceStatus: d.status,
            accessories: {
              create: d.accessories.map((a) => ({
                accessoryCode: a.accessoryCode,
                accessoryName: a.accessoryName,
                accessoryType: a.accessoryType,
                unit: a.unit,
              })),
            },
          })),
        },
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: DETAIL_INCLUDE,
    });
    return toDetail(audit);
  }

  async start(id: number) {
    await this.findAudit(id);
    await this.transition(this.prisma, id, AUDIT_STATUS.NOT_STARTED, {
      status: AUDIT_STATUS.IN_PROGRESS,
      startedAt: new Date(),
    });
    return this.getById(id);
  }

  /** Huỷ chỉ khi chưa bắt đầu — đợt lập nhầm nhả máy cho đợt khác. */
  async cancel(id: number) {
    await this.findAudit(id);
    await this.transition(this.prisma, id, AUDIT_STATUS.NOT_STARTED, {
      status: AUDIT_STATUS.CANCELLED,
    });
    return this.getById(id);
  }

  /** Xoá mềm (TP Kế toán). Không hoàn tác trạng thái thiết bị; đợt đang mở tự nhả máy. */
  async remove(id: number) {
    await this.findAudit(id);
    const { count } = await this.prisma.audit.updateMany({
      where: { id, status: { in: DELETABLE_AUDIT_STATUSES } },
      data: { status: AUDIT_STATUS.DELETED },
    });
    if (count === 0) throw new BadRequestException(AUDIT_WRONG_STATE);
    return this.getById(id);
  }

  /** Dọn thùng rác — xoá cứng đợt "Đã xóa". Đợt còn trong bảng tổng hợp (FK RESTRICT) bị giữ lại kèm lý do;
   *  id chưa xoá mềm bị bỏ qua lặng lẽ. Dòng / linh kiện / thành viên đi theo cascade. */
  async purge(ids: number[]) {
    return this.prisma.$transaction(async (tx) => {
      const links = await tx.auditSummaryAudit.findMany({
        where: { auditId: { in: ids } },
      });
      const blocked = new Set(links.map((l) => l.auditId));
      const kept = await tx.audit.findMany({
        where: { id: { in: [...blocked] }, status: AUDIT_STATUS.DELETED },
        select: { id: true, unitName: true },
      });
      const skipped = kept.map((a) => ({
        id: a.id,
        unitName: a.unitName,
        reasons: links
          .filter((l) => l.auditId === a.id)
          .map((l) => `bảng tổng hợp #${l.summaryId}`),
      }));
      const { count } = await tx.audit.deleteMany({
        where: {
          id: { in: ids.filter((id) => !blocked.has(id)) },
          status: AUDIT_STATUS.DELETED,
        },
      });
      return { count, skipped };
    });
  }

  async setMembers(id: number, userIds: number[]) {
    const audit = await this.findAudit(id);
    this.requireStatus(audit, [
      AUDIT_STATUS.NOT_STARTED,
      AUDIT_STATUS.IN_PROGRESS,
    ]);
    await this.requireActiveUsers(userIds);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditMember.deleteMany({ where: { auditId: id } });
      if (userIds.length > 0) {
        await tx.auditMember.createMany({
          data: userIds.map((userId) => ({ auditId: id, userId })),
        });
      }
    });
    return this.getById(id);
  }

  async updateItem(id: number, itemId: number, dto: UpdateAuditLineDto) {
    const audit = await this.findAudit(id);
    this.requireStatus(audit, [AUDIT_STATUS.IN_PROGRESS]);
    if (!audit.items.some((i) => i.id === itemId)) {
      throw new NotFoundException(LINE_NOT_FOUND);
    }
    // Ghi có điều kiện trạng thái: đợt vừa chuyển khỏi "Đang kiểm kê" giữa chừng thì không ghi đè.
    const { count } = await this.prisma.auditItem.updateMany({
      where: {
        id: itemId,
        auditId: id,
        audit: { status: AUDIT_STATUS.IN_PROGRESS },
      },
      data: { result: dto.result, note: dto.note },
    });
    if (count === 0) throw new BadRequestException(AUDIT_WRONG_STATE);
    return this.getById(id);
  }

  async updateAccessory(
    id: number,
    accessoryId: number,
    dto: UpdateAuditLineDto,
  ) {
    const audit = await this.findAudit(id);
    this.requireStatus(audit, [AUDIT_STATUS.IN_PROGRESS]);
    if (
      !audit.items.some((i) => i.accessories.some((a) => a.id === accessoryId))
    ) {
      throw new NotFoundException(LINE_NOT_FOUND);
    }
    const { count } = await this.prisma.auditItemAccessory.updateMany({
      where: {
        id: accessoryId,
        auditItem: {
          auditId: id,
          audit: { status: AUDIT_STATUS.IN_PROGRESS },
        },
      },
      data: { result: dto.result, note: dto.note },
    });
    if (count === 0) throw new BadRequestException(AUDIT_WRONG_STATE);
    return this.getById(id);
  }

  /** "Ghi Đủ cho dòng chưa đếm" — không đè dòng đã có kết quả. */
  async markUncountedOk(id: number) {
    const audit = await this.findAudit(id);
    this.requireStatus(audit, [AUDIT_STATUS.IN_PROGRESS]);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditItem.updateMany({
        where: { auditId: id, result: null },
        data: { result: AUDIT_RESULT.OK },
      });
      await tx.auditItemAccessory.updateMany({
        where: {
          auditItemId: { in: audit.items.map((i) => i.id) },
          result: null,
        },
        data: { result: AUDIT_RESULT.OK },
      });
    });
    return this.getById(id);
  }

  async submit(id: number) {
    const audit = await this.findAudit(id);
    this.requireStatus(audit, [AUDIT_STATUS.IN_PROGRESS]);
    const { totalLines, countedLines } = countLines(audit.items);
    if (countedLines < totalLines) {
      throw new BadRequestException(
        `Còn ${totalLines - countedLines} dòng chưa có kết quả kiểm kê`,
      );
    }
    await this.transition(this.prisma, id, AUDIT_STATUS.IN_PROGRESS, {
      status: AUDIT_STATUS.PENDING,
      submittedAt: new Date(),
      rejectReason: null,
      decidedById: null,
      decidedAt: null,
    });
    return this.getById(id);
  }

  /** Từ chối KHÔNG kết thúc đợt: trả về Đang kiểm kê để Chuyên viên sửa rồi gửi lại (#13). */
  async reject(id: number, decidedById: number, reason: string) {
    await this.findAudit(id);
    await this.transition(this.prisma, id, AUDIT_STATUS.PENDING, {
      status: AUDIT_STATUS.IN_PROGRESS,
      rejectReason: reason,
      decidedById,
      decidedAt: new Date(),
    });
    return this.getById(id);
  }

  // --- helpers ---------------------------------------------------------

  /** Thiết bị không còn cột phòng ban: thuộc đơn vị = đang cấp cho người của phòng đó (#5). */
  private async findDevicesInScope(
    dto: CreateAuditDto,
    departmentId: number | null,
  ) {
    const filters: Prisma.DeviceWhereInput = {
      deviceTypeId: dto.deviceTypeId,
      location: dto.location,
    };
    if (departmentId === null) {
      return this.prisma.device.findMany({
        where: { ...filters, status: DEVICE_STATUS.IN_STOCK },
        include: DEVICE_WITH_RELATIONS,
        orderBy: { id: 'asc' },
      });
    }
    const people = await this.prisma.user.findMany({
      where: { departmentId },
      select: { id: true },
    });
    return this.prisma.device.findMany({
      where: {
        ...filters,
        status: DEVICE_STATUS.ALLOCATED,
        currentUserId: { in: people.map((u) => u.id) },
      },
      include: DEVICE_WITH_RELATIONS,
      orderBy: { id: 'asc' },
    });
  }

  private async requireNotInOpenAudit(deviceIds: number[]) {
    const open = await this.prisma.audit.findMany({
      where: { status: { in: OPEN_AUDIT_STATUSES } },
      select: { id: true },
    });
    if (open.length === 0) return;
    const taken = await this.prisma.auditItem.findMany({
      where: {
        auditId: { in: open.map((a) => a.id) },
        deviceId: { in: deviceIds },
      },
      select: { deviceCode: true },
    });
    if (taken.length > 0) {
      throw new BadRequestException(
        `Thiết bị đang thuộc đợt kiểm kê khác chưa xong: ${taken.map((t) => t.deviceCode).join(', ')}`,
      );
    }
  }

  private async requireDepartment(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
    });
    if (!department) {
      throw new BadRequestException('Đơn vị kiểm kê không tồn tại');
    }
    return department;
  }

  protected async requireActiveUsers(ids: number[]) {
    if (ids.length === 0) return;
    const found = await this.prisma.user.findMany({
      where: { id: { in: ids }, status: USER_STATUS.ACTIVE },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      const ok = new Set(found.map((u) => u.id));
      const bad = ids.filter((id) => !ok.has(id));
      const users = await this.prisma.user.findMany({
        where: { id: { in: bad } },
        select: { id: true, fullName: true },
      });
      const names = bad.map(
        (id) => users.find((u) => u.id === id)?.fullName ?? `#${id}`,
      );
      throw new BadRequestException(
        `Thành viên tham gia không hợp lệ hoặc đã ngừng hoạt động: ${names.join(', ')}`,
      );
    }
  }

  async approve(id: number, decidedById: number) {
    const audit = await this.findAudit(id);
    this.requireStatus(audit, [AUDIT_STATUS.PENDING]);
    // Sắp theo deviceId: mọi luồng ghi Device theo cùng thứ tự khoá, tránh deadlock.
    const flagged = audit.items
      .filter(
        (i) =>
          i.result === AUDIT_RESULT.MISSING || i.result === AUDIT_RESULT.BROKEN,
      )
      .sort((a, b) => a.deviceId - b.deviceId);

    // Đọc trước, ngoài transaction: báo đủ danh sách máy lệch snapshot trong một lần, chưa ghi gì (#17).
    const current = await this.prisma.device.findMany({
      where: { id: { in: flagged.map((i) => i.deviceId) } },
    });
    const changed = flagged.filter((i) => {
      const d = current.find((x) => x.id === i.deviceId);
      return (
        !d || d.status !== i.deviceStatus || d.currentUserId !== i.holderUserId
      );
    });
    if (changed.length > 0) {
      throw new BadRequestException(
        devicesChanged(changed.map((i) => i.deviceCode)),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, id, AUDIT_STATUS.PENDING, {
        status: AUDIT_STATUS.APPROVED,
        decidedById,
        decidedAt: new Date(),
      });
      // Ghi có điều kiện = snapshot: máy đổi giữa lúc đọc và lúc ghi → count 0 → rollback cả đợt.
      for (const item of flagged) {
        const { count } = await tx.device.updateMany({
          where: {
            id: item.deviceId,
            status: item.deviceStatus,
            currentUserId: item.holderUserId,
          },
          data: {
            status:
              item.result === AUDIT_RESULT.MISSING
                ? DEVICE_STATUS.LOST
                : DEVICE_STATUS.PENDING_DISPOSAL,
          },
        });
        if (count === 0) {
          throw new BadRequestException(devicesChanged([item.deviceCode]));
        }
      }
    });
    return this.getById(id);
  }

  /** Ghi có điều kiện status = `from` ngay trong câu update: 2 request gần như đồng thời không
   *  cùng lọt (đọc-rồi-ghi không atomic). count = 0 → đợt đã bị xử lý giữa chừng. */
  protected async transition(
    tx: Pick<PrismaService, 'audit'>,
    id: number,
    from: string,
    data: Prisma.AuditUncheckedUpdateManyInput,
  ) {
    const { count } = await tx.audit.updateMany({
      where: { id, status: from },
      data,
    });
    if (count === 0) throw new BadRequestException(AUDIT_WRONG_STATE);
  }

  protected requireStatus(audit: { status: string }, allowed: string[]) {
    if (!allowed.includes(audit.status)) {
      throw new BadRequestException(AUDIT_WRONG_STATE);
    }
  }

  protected async findAudit(id: number) {
    // Id ngoài phạm vi int4: Prisma ném lỗi 500 — coi như không tồn tại.
    if (Math.abs(id) > MAX_INT32) throw new NotFoundException(AUDIT_NOT_FOUND);
    const audit = await this.prisma.audit.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!audit) throw new NotFoundException(AUDIT_NOT_FOUND);
    return audit;
  }
}
