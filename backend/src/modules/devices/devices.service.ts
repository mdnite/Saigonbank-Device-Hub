import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MAX_INT32 } from '../users/users.dto';
import { DEVICE_STATUS } from './device-status';
import type { CreateDeviceDto, UpdateDeviceDto } from './devices.dto';

export const DEVICE_NOT_FOUND = 'Thiết bị không tồn tại';
export const DEVICE_PENDING = 'Thiết bị đang chờ duyệt, không thể sửa hoặc xoá';
export const DEVICE_NOT_LOST = 'Thiết bị không ở trạng thái Thất lạc';

export const DEVICE_WITH_RELATIONS = {
  deviceType: true,
  currentUser: true,
  accessories: true,
} as const;

type DeviceWithRelations = Prisma.DeviceGetPayload<{
  include: typeof DEVICE_WITH_RELATIONS;
}>;

export function toDeviceItem(d: DeviceWithRelations) {
  return {
    id: d.id,
    deviceCode: d.deviceCode,
    deviceName: d.deviceName,
    serialNumber: d.serialNumber,
    specDetail: d.specDetail,
    unit: d.unit,
    status: d.status,
    allocatedOn: d.allocatedOn,
    location: d.location,
    purchaseDate: d.purchaseDate,
    supplier: d.supplier,
    warrantyMonths: d.warrantyMonths,
    warrantyCondition: d.warrantyCondition,
    warrantyExpiresOn: d.warrantyExpiresOn,
    deviceType: {
      id: d.deviceType.id,
      typeName: d.deviceType.typeName,
      prefix: d.deviceType.prefix,
    },
    currentUser: d.currentUser && {
      id: d.currentUser.id,
      fullName: d.currentUser.fullName,
      username: d.currentUser.username,
    },
    accessories: (d.accessories ?? []).map((a) => ({
      id: a.id,
      accessoryCode: a.accessoryCode,
      accessoryName: a.accessoryName,
      accessoryType: a.accessoryType,
      unit: a.unit,
    })),
  };
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ponytail: chưa phân trang (DataTable FE cũng chưa có) — thêm skip/take khi đủ nhiều thiết bị.
  async list(q: {
    search?: string;
    status?: string;
    deviceTypeId?: number;
    currentUserId?: number;
  }) {
    const s = q.search?.trim();
    const devices = await this.prisma.device.findMany({
      where: {
        status: q.status ?? { not: DEVICE_STATUS.DELETED },
        deviceTypeId: q.deviceTypeId,
        currentUserId: q.currentUserId,
        ...(s
          ? {
              OR: [
                {
                  deviceCode: {
                    contains: s,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  deviceName: {
                    contains: s,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  serialNumber: {
                    contains: s,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            }
          : {}),
      },
      include: DEVICE_WITH_RELATIONS,
      orderBy: { id: 'asc' },
    });
    return devices.map(toDeviceItem);
  }

  async getById(id: number) {
    await this.findLiveDevice(id);
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: DEVICE_WITH_RELATIONS,
    });
    return toDeviceItem(device!);
  }

  async create(dto: CreateDeviceDto) {
    const type = await this.requireDeviceType(dto.deviceTypeId);
    this.requirePrefix(dto.deviceCode, type.prefix);
    await this.requireUniqueCode(dto.deviceCode);
    await this.requireUniqueSerial(dto.serialNumber);

    try {
      const device = await this.prisma.device.create({
        data: {
          ...this.createScalars(dto),
          // Thiết bị mới luôn vào kho — người giữ chỉ được gán khi đơn Cấp phát được duyệt.
          status: DEVICE_STATUS.IN_STOCK,
          accessories: dto.accessories?.length
            ? { create: dto.accessories }
            : undefined,
        },
        include: DEVICE_WITH_RELATIONS,
      });
      return toDeviceItem(device);
    } catch (e) {
      throw this.asConflict(e);
    }
  }

  async update(id: number, dto: UpdateDeviceDto) {
    const current = await this.findLiveDevice(id);
    this.requireNotPending(current.status);

    const typeId = dto.deviceTypeId ?? current.deviceTypeId;
    const type = await this.requireDeviceType(typeId);
    if (dto.deviceCode) this.requirePrefix(dto.deviceCode, type.prefix);
    else this.requirePrefix(current.deviceCode, type.prefix);

    if (dto.deviceCode && dto.deviceCode !== current.deviceCode) {
      await this.requireUniqueCode(dto.deviceCode);
    }
    if (dto.serialNumber && dto.serialNumber !== current.serialNumber) {
      await this.requireUniqueSerial(dto.serialNumber);
    }

    try {
      const device = await this.prisma.device.update({
        where: { id },
        data: {
          ...this.updateScalars(dto),
          // PATCH gửi accessories => thay thế toàn bộ danh sách.
          ...(dto.accessories
            ? { accessories: { deleteMany: {}, create: dto.accessories } }
            : {}),
        },
        include: DEVICE_WITH_RELATIONS,
      });
      return toDeviceItem(device);
    } catch (e) {
      throw this.asConflict(e);
    }
  }

  /** Xoá mềm: chỉ đổi Status, không bao giờ xoá row. */
  async softDelete(id: number): Promise<void> {
    const current = await this.findLiveDevice(id);
    this.requireNotPending(current.status);
    await this.prisma.device.update({
      where: { id },
      data: { status: DEVICE_STATUS.DELETED },
    });
  }

  /** "Tìm thấy" máy Thất lạc (#20): về Đã cấp phát nếu còn người giữ, ngược lại Trong kho. */
  async markFound(id: number) {
    const current = await this.findLiveDevice(id);
    const { count } = await this.prisma.device.updateMany({
      where: { id, status: DEVICE_STATUS.LOST },
      data: {
        status:
          current.currentUserId === null
            ? DEVICE_STATUS.IN_STOCK
            : DEVICE_STATUS.ALLOCATED,
      },
    });
    if (count === 0) throw new BadRequestException(DEVICE_NOT_LOST);
    return this.getById(id);
  }

  /** Dọn thùng rác: xoá cứng — chỉ những id đã ở Status "Đã xóa", id khác bị bỏ qua. */
  async purge(ids: number[]): Promise<number> {
    // DeviceOrderItem.deviceId và DeviceTransferItem.deviceId đều FK RESTRICT — thiết bị từng
    // nằm trong bất kỳ đơn/lệnh nào (đã duyệt/từ chối/còn chờ) không thể xoá cứng. Bỏ qua các
    // id đó, giống cách users.service.ts đã làm với DeviceOrder/DeviceTransfer cho /users/purge.
    const [referencedByOrders, referencedByTransfers] = await Promise.all([
      this.prisma.deviceOrderItem.findMany({
        where: { deviceId: { in: ids } },
        select: { deviceId: true },
      }),
      this.prisma.deviceTransferItem.findMany({
        where: { deviceId: { in: ids } },
        select: { deviceId: true },
      }),
    ]);
    const blocked = new Set([
      ...referencedByOrders.map((i) => i.deviceId),
      ...referencedByTransfers.map((i) => i.deviceId),
    ]);
    const purgeable = ids.filter((id) => !blocked.has(id));

    const { count } = await this.prisma.device.deleteMany({
      where: { id: { in: purgeable }, status: DEVICE_STATUS.DELETED },
    });
    return count;
  }

  deviceTypes() {
    return this.prisma.deviceType.findMany({ orderBy: { id: 'asc' } });
  }

  // --- helpers ---------------------------------------------------------

  // Tách create/update thay vì 1 hàm nhận union: dto: CreateDeviceDto | UpdateDeviceDto
  // sẽ làm TS suy rộng deviceCode/deviceName/specDetail/unit/deviceTypeId thành "T | undefined"
  // kể cả ở nhánh create (các trường này bắt buộc trong CreateDeviceDto) — Prisma create() sẽ
  // không còn phân biệt được DeviceCreateInput/DeviceUncheckedCreateInput qua XOR, phải ép kiểu.
  private createScalars(dto: CreateDeviceDto) {
    return {
      deviceCode: dto.deviceCode,
      deviceName: dto.deviceName,
      specDetail: dto.specDetail,
      unit: dto.unit,
      deviceTypeId: dto.deviceTypeId,
      serialNumber: dto.serialNumber,
      location: dto.location,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      supplier: dto.supplier,
      warrantyMonths: dto.warrantyMonths,
      warrantyCondition: dto.warrantyCondition,
      warrantyExpiresOn: dto.warrantyExpiresOn
        ? new Date(dto.warrantyExpiresOn)
        : undefined,
    };
  }

  private updateScalars(dto: UpdateDeviceDto) {
    return {
      deviceCode: dto.deviceCode,
      deviceName: dto.deviceName,
      specDetail: dto.specDetail,
      unit: dto.unit,
      deviceTypeId: dto.deviceTypeId,
      serialNumber: dto.serialNumber,
      location: dto.location,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      supplier: dto.supplier,
      warrantyMonths: dto.warrantyMonths,
      warrantyCondition: dto.warrantyCondition,
      warrantyExpiresOn: dto.warrantyExpiresOn
        ? new Date(dto.warrantyExpiresOn)
        : undefined,
    };
  }

  private requirePrefix(code: string, prefix: string) {
    if (!code.startsWith(`${prefix}-`)) {
      throw new BadRequestException(
        `Mã thiết bị phải bắt đầu bằng "${prefix}" theo loại thiết bị đã chọn`,
      );
    }
  }

  private async requireDeviceType(id: number) {
    const type = await this.prisma.deviceType.findUnique({ where: { id } });
    if (!type) throw new BadRequestException('Loại thiết bị không tồn tại');
    return type;
  }

  private async requireUniqueCode(deviceCode: string) {
    if (await this.prisma.device.findUnique({ where: { deviceCode } })) {
      throw new ConflictException('Mã thiết bị đã tồn tại');
    }
  }

  private async requireUniqueSerial(serialNumber?: string) {
    if (!serialNumber) return;
    if (await this.prisma.device.findUnique({ where: { serialNumber } })) {
      throw new ConflictException('Số serial đã tồn tại');
    }
  }

  /** Thiết bị đang nằm trong đơn/lệnh chờ duyệt bị khoá — sửa/xoá lúc này làm lệch đơn/lệnh đó. */
  private requireNotPending(status: string) {
    if (status === DEVICE_STATUS.PENDING_APPROVAL) {
      throw new BadRequestException(DEVICE_PENDING);
    }
  }

  private asConflict(e: unknown) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException('Mã thiết bị hoặc số serial đã tồn tại');
    }
    return e;
  }

  private async findLiveDevice(id: number) {
    // Id ngoài phạm vi int4: Prisma ném lỗi 500 — coi như thiết bị không tồn tại.
    if (Math.abs(id) > MAX_INT32) throw new NotFoundException(DEVICE_NOT_FOUND);
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device || device.status === DEVICE_STATUS.DELETED) {
      throw new NotFoundException(DEVICE_NOT_FOUND);
    }
    return device;
  }
}
