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
  OPEN_AUDIT_STATUSES,
  WAREHOUSE_UNIT_NAME,
} from './audit-status';
import type { CreateAuditDto, ListAuditsQuery } from './audits.dto';

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
        status: q.status,
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
    // lúc có thể lọt cả hai. Thêm khoá (SELECT … FOR UPDATE) nếu có nhiều CTV lập lịch song song.
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
      throw new BadRequestException(
        'Thành viên tham gia không hợp lệ hoặc đã ngừng hoạt động',
      );
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
