import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DEVICE_STATUS } from '../devices/device-status';
import { DEVICE_WITH_RELATIONS, toDeviceItem } from '../devices/devices.service';
import { USER_STATUS } from '../identity/user-status';
import { MAX_INT32 } from '../users/users.dto';
import { TRANSFER_STATUS } from './device-transfer-status';
import type { CreateDeviceTransferDto, ListDeviceTransfersQuery } from './device-transfers.dto';

export const TRANSFER_NOT_FOUND = 'Đơn không tồn tại';
const TRANSFER_ALREADY_DECIDED = 'Đơn đã được xử lý';

const WITH_RELATIONS = {
  fromUser: true,
  toUser: true,
  createdBy: true,
  decidedBy: true,
  items: { include: { device: { include: DEVICE_WITH_RELATIONS } } },
} as const;

type TransferWithRelations = Prisma.DeviceTransferGetPayload<{
  include: typeof WITH_RELATIONS;
}>;

function toListItem(t: TransferWithRelations) {
  return {
    id: t.id,
    status: t.status,
    note: t.note,
    rejectReason: t.rejectReason,
    decidedAt: t.decidedAt,
    createdAt: t.createdAt,
    fromUser: { id: t.fromUser.id, fullName: t.fromUser.fullName, username: t.fromUser.username },
    toUser: { id: t.toUser.id, fullName: t.toUser.fullName, username: t.toUser.username },
    createdBy: { id: t.createdBy.id, fullName: t.createdBy.fullName },
    decidedBy: t.decidedBy && { id: t.decidedBy.id, fullName: t.decidedBy.fullName },
    deviceCount: t.items.length,
  };
}

function toDetail(t: TransferWithRelations) {
  return {
    ...toListItem(t),
    items: t.items.map((i) => ({ id: i.id, device: toDeviceItem(i.device) })),
  };
}

@Injectable()
export class DeviceTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListDeviceTransfersQuery) {
    const transfers = await this.prisma.deviceTransfer.findMany({
      where: { status: q.status },
      include: WITH_RELATIONS,
      orderBy: { id: 'desc' },
    });
    return transfers.map(toListItem);
  }

  async getById(id: number) {
    const transfer = await this.findTransfer(id);
    return toDetail(transfer);
  }

  async create(dto: CreateDeviceTransferDto, createdById: number) {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Người nhận phải khác người đang giữ');
    }
    await this.requireUser(dto.fromUserId);
    await this.requireUser(dto.toUserId);
    await this.requireEligibleDevices(dto.deviceIds, dto.fromUserId);

    const transfer = await this.prisma.deviceTransfer.create({
      data: {
        note: dto.note ?? null,
        fromUserId: dto.fromUserId,
        toUserId: dto.toUserId,
        createdById,
        items: { create: dto.deviceIds.map((deviceId) => ({ deviceId })) },
      },
      include: WITH_RELATIONS,
    });
    return toDetail(transfer);
  }

  async approve(id: number, decidedById: number) {
    const transfer = await this.findPendingTransfer(id);
    // Người nhận có thể đã bị xoá mềm SAU khi lệnh được tạo (create() chỉ kiểm tra lúc tạo) —
    // kiểm tra lại ở đây để không duyệt lệnh cho người dùng không còn tồn tại.
    await this.requireUser(transfer.toUserId);
    const deviceIds = transfer.items.map((i) => i.deviceId);
    const devicesById = await this.requireEligibleDevices(deviceIds, transfer.fromUserId);

    await this.prisma.$transaction(async (tx) => {
      const data = {
        currentUserId: transfer.toUserId,
        departmentId: transfer.toUser.departmentId,
        allocatedOn: new Date(),
      };
      // Ghi có điều kiện — where lặp lại đúng điều kiện requireEligibleDevices đã kiểm tra ở
      // trên, ngay trong câu update — chặn trường hợp 2 lệnh cùng nhắm 1 thiết bị được duyệt
      // gần như đồng thời: chỉ lệnh nào ghi Device trước mới còn khớp where khi tới lượt nó;
      // lệnh còn lại count=0 → báo lỗi thay vì âm thầm ghi đè.
      const eligibleWhere = this.eligibleWhere(transfer.fromUserId);
      for (const deviceId of deviceIds) {
        const { count } = await tx.device.updateMany({
          where: { id: deviceId, ...eligibleWhere },
          data,
        });
        if (count === 0) {
          const device = devicesById.get(deviceId)!;
          throw new BadRequestException(this.ineligibleMessage(device.deviceCode));
        }
      }
      await this.decide(tx, id, decidedById, TRANSFER_STATUS.APPROVED);
    });

    return this.getById(id);
  }

  async reject(id: number, decidedById: number, reason: string) {
    await this.findPendingTransfer(id);
    await this.decide(this.prisma, id, decidedById, TRANSFER_STATUS.REJECTED, reason);
    return this.getById(id);
  }

  // --- helpers ---------------------------------------------------------

  /** Ghi có điều kiện status="Chờ duyệt" ngay trong câu update — chặn 2 request duyệt/từ chối
   *  gần như đồng thời cùng lọt qua findPendingTransfer() (đọc-rồi-ghi là 2 câu lệnh riêng,
   *  không atomic). count=0 nghĩa là lệnh đã bị xử lý giữa lúc đọc và lúc ghi. */
  private async decide(
    tx: Pick<PrismaService, 'deviceTransfer'>,
    id: number,
    decidedById: number,
    status: string,
    rejectReason?: string,
  ) {
    const { count } = await tx.deviceTransfer.updateMany({
      where: { id, status: TRANSFER_STATUS.PENDING },
      data: {
        status,
        decidedById,
        decidedAt: new Date(),
        rejectReason: rejectReason ?? null,
      },
    });
    if (count === 0) throw new BadRequestException(TRANSFER_ALREADY_DECIDED);
  }

  /** Trả về map deviceId -> Device đã kiểm tra hợp lệ, để approve() tái dùng deviceCode khi cần
   *  báo lỗi ở bước ghi có điều kiện trong transaction (khỏi truy vấn lại). */
  private async requireEligibleDevices(deviceIds: number[], fromUserId: number) {
    const devices = await this.prisma.device.findMany({ where: { id: { in: deviceIds } } });
    const byId = new Map(devices.map((d) => [d.id, d]));
    for (const id of deviceIds) {
      const device = byId.get(id);
      if (!device) throw new BadRequestException('Thiết bị không tồn tại');
      if (!(device.status === DEVICE_STATUS.ALLOCATED && device.currentUserId === fromUserId)) {
        throw new BadRequestException(this.ineligibleMessage(device.deviceCode));
      }
    }
    return byId;
  }

  /** Where bổ sung để lặp lại đúng điều kiện eligible ngay trong câu ghi Device lúc duyệt. */
  private eligibleWhere(fromUserId: number) {
    return { status: DEVICE_STATUS.ALLOCATED, currentUserId: fromUserId };
  }

  private ineligibleMessage(deviceCode: string): string {
    return `Thiết bị "${deviceCode}" không do người này đang giữ`;
  }

  private async requireUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.status === USER_STATUS.DELETED) {
      throw new BadRequestException('Người dùng không tồn tại');
    }
    return user;
  }

  private async findTransfer(id: number) {
    if (Math.abs(id) > MAX_INT32) throw new NotFoundException(TRANSFER_NOT_FOUND);
    const transfer = await this.prisma.deviceTransfer.findUnique({
      where: { id },
      include: WITH_RELATIONS,
    });
    if (!transfer) throw new NotFoundException(TRANSFER_NOT_FOUND);
    return transfer;
  }

  private async findPendingTransfer(id: number) {
    const transfer = await this.findTransfer(id);
    if (transfer.status !== TRANSFER_STATUS.PENDING) {
      throw new BadRequestException(TRANSFER_ALREADY_DECIDED);
    }
    return transfer;
  }
}
