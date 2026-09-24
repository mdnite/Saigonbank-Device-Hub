import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Device } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DEVICE_STATUS } from '../devices/device-status';
import {
  DEVICE_WITH_RELATIONS,
  toDeviceItem,
} from '../devices/devices.service';
import { USER_STATUS } from '../identity/user-status';
import { MAX_INT32 } from '../users/users.dto';
import { ORDER_STATUS, ORDER_TYPE } from './device-order-status';
import type {
  CreateDeviceOrderDto,
  ListDeviceOrdersQuery,
} from './device-orders.dto';

export const ORDER_NOT_FOUND = 'Đơn không tồn tại';
const ORDER_ALREADY_DECIDED = 'Đơn đã được xử lý';

// Cùng cách devices.service.ts làm với DEVICE_WITH_RELATIONS: include lồng nhau tới tận Device
// dùng lại đúng hằng số đó, nên Prisma.DeviceOrderGetPayload ở dưới suy ra field `device` khớp
// 1:1 với DeviceWithRelations nội bộ của devices.service.ts — toDeviceItem() nhận thẳng được.
const WITH_RELATIONS = {
  targetUser: true,
  createdBy: true,
  decidedBy: true,
  items: { include: { device: { include: DEVICE_WITH_RELATIONS } } },
} as const;

type OrderWithRelations = Prisma.DeviceOrderGetPayload<{
  include: typeof WITH_RELATIONS;
}>;

function toListItem(o: OrderWithRelations) {
  return {
    id: o.id,
    type: o.type,
    status: o.status,
    note: o.note,
    rejectReason: o.rejectReason,
    decidedAt: o.decidedAt,
    createdAt: o.createdAt,
    targetUser: {
      id: o.targetUser.id,
      fullName: o.targetUser.fullName,
      username: o.targetUser.username,
    },
    createdBy: { id: o.createdBy.id, fullName: o.createdBy.fullName },
    decidedBy: o.decidedBy && {
      id: o.decidedBy.id,
      fullName: o.decidedBy.fullName,
    },
    deviceCount: o.items.length,
  };
}

function toDetail(o: OrderWithRelations) {
  return {
    ...toListItem(o),
    items: o.items.map((i) => ({ id: i.id, device: toDeviceItem(i.device) })),
  };
}

@Injectable()
export class DeviceOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListDeviceOrdersQuery) {
    const orders = await this.prisma.deviceOrder.findMany({
      where: { type: q.type, status: q.status },
      include: WITH_RELATIONS,
      orderBy: { id: 'desc' },
    });
    return orders.map(toListItem);
  }

  async getById(id: number) {
    const order = await this.findOrder(id);
    return toDetail(order);
  }

  async create(dto: CreateDeviceOrderDto, createdById: number) {
    const targetUser = await this.requireUser(dto.targetUserId);
    await this.requireEligibleDevices(dto.type, dto.deviceIds, targetUser.id);

    const order = await this.prisma.deviceOrder.create({
      data: {
        type: dto.type,
        note: dto.note ?? null,
        targetUserId: dto.targetUserId,
        createdById,
        items: { create: dto.deviceIds.map((deviceId) => ({ deviceId })) },
      },
      include: WITH_RELATIONS,
    });
    return toDetail(order);
  }

  async approve(id: number, decidedById: number) {
    const order = await this.findPendingOrder(id);
    const deviceIds = order.items.map((i) => i.deviceId);
    const devicesById = await this.requireEligibleDevices(
      order.type,
      deviceIds,
      order.targetUserId,
    );

    await this.prisma.$transaction(async (tx) => {
      const data =
        order.type === ORDER_TYPE.ALLOCATE
          ? {
              status: DEVICE_STATUS.ALLOCATED,
              currentUserId: order.targetUserId,
              departmentId: order.targetUser.departmentId,
              allocatedOn: new Date(),
            }
          : {
              status: DEVICE_STATUS.IN_STOCK,
              currentUserId: null,
              departmentId: null,
              allocatedOn: null,
            };
      // Ghi có điều kiện — where lặp lại đúng điều kiện requireEligibleDevices đã kiểm tra ở trên,
      // ngay trong câu update — chặn trường hợp 2 đơn cùng nhắm 1 thiết bị được duyệt gần như
      // đồng thời: cả hai đều qua được requireEligibleDevices (đọc trước transaction), nhưng chỉ
      // đơn nào ghi Device trước mới còn khớp where khi tới lượt nó; đơn còn lại count=0 → báo lỗi
      // thay vì âm thầm ghi đè (xem quyết định #6).
      // Ghi có điều kiện — where lặp lại đúng điều kiện requireEligibleDevices đã kiểm tra ở trên,
      // ngay trong câu update — chặn trường hợp 2 đơn cùng nhắm 1 thiết bị được duyệt gần như
      // đồng thời: cả hai đều qua được requireEligibleDevices (đọc trước transaction), nhưng chỉ
      // đơn nào ghi Device trước mới còn khớp where khi tới lượt nó; đơn còn lại count=0 → báo lỗi
      // thay vì âm thầm ghi đè (xem quyết định #6).
      const eligibleWhere = this.eligibleWhere(order.type, order.targetUserId);
      for (const deviceId of deviceIds) {
        const { count } = await tx.device.updateMany({
          where: { id: deviceId, ...eligibleWhere },
          data,
        });
        if (count === 0) {
          const device = devicesById.get(deviceId)!;
          throw new BadRequestException(
            this.ineligibleMessage(order.type, device.deviceCode),
          );
        }
      }
      await this.decide(tx, id, decidedById, ORDER_STATUS.APPROVED);
    });

    return this.getById(id);
  }

  async reject(id: number, decidedById: number, reason: string) {
    await this.findPendingOrder(id);
    await this.decide(
      this.prisma,
      id,
      decidedById,
      ORDER_STATUS.REJECTED,
      reason,
    );
    return this.getById(id);
  }

  // --- helpers ---------------------------------------------------------

  /** Ghi có điều kiện status="Chờ duyệt" ngay trong câu update — chặn 2 request duyệt/từ chối
   *  gần như đồng thời cùng lọt qua findPendingOrder() (đọc-rồi-ghi là 2 câu lệnh riêng, không
   *  atomic). count=0 nghĩa là đơn đã bị người khác xử lý giữa lúc đọc và lúc ghi. */
  private async decide(
    tx: Pick<PrismaService, 'deviceOrder'>,
    id: number,
    decidedById: number,
    status: string,
    rejectReason?: string,
  ) {
    const { count } = await tx.deviceOrder.updateMany({
      where: { id, status: ORDER_STATUS.PENDING },
      data: {
        status,
        decidedById,
        decidedAt: new Date(),
        rejectReason: rejectReason ?? null,
      },
    });
    if (count === 0) throw new BadRequestException(ORDER_ALREADY_DECIDED);
  }

  /** Trả về map deviceId -> Device đã kiểm tra hợp lệ, để approve() tái dùng deviceCode khi cần
   *  báo lỗi ở bước ghi có điều kiện trong transaction (khỏi truy vấn lại). */
  private async requireEligibleDevices(
    type: string,
    deviceIds: number[],
    targetUserId: number,
  ) {
    const devices = await this.prisma.device.findMany({
      where: { id: { in: deviceIds } },
    });
    const byId = new Map(devices.map((d) => [d.id, d]));
    for (const id of deviceIds) {
      const device = byId.get(id);
      if (!device) throw new BadRequestException('Thiết bị không tồn tại');
      if (!this.isEligible(type, device, targetUserId)) {
        throw new BadRequestException(
          this.ineligibleMessage(type, device.deviceCode),
        );
      }
    }
    return byId;
  }

  private isEligible(
    type: string,
    device: Device,
    targetUserId: number,
  ): boolean {
    return type === ORDER_TYPE.ALLOCATE
      ? device.status === DEVICE_STATUS.IN_STOCK
      : device.status === DEVICE_STATUS.ALLOCATED &&
          device.currentUserId === targetUserId;
  }

  /** Where bổ sung để lặp lại đúng điều kiện isEligible() ngay trong câu ghi Device — dùng ở
   *  approve() để updateMany có điều kiện (xem ghi chú trong approve()). */
  private eligibleWhere(type: string, targetUserId: number) {
    return type === ORDER_TYPE.ALLOCATE
      ? { status: DEVICE_STATUS.IN_STOCK }
      : { status: DEVICE_STATUS.ALLOCATED, currentUserId: targetUserId };
  }

  private ineligibleMessage(type: string, deviceCode: string): string {
    return type === ORDER_TYPE.ALLOCATE
      ? `Thiết bị "${deviceCode}" không còn trong kho`
      : `Thiết bị "${deviceCode}" không do người này đang giữ`;
  }

  private async requireUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.status === USER_STATUS.DELETED) {
      throw new BadRequestException('Người dùng không tồn tại');
    }
    return user;
  }

  private async findOrder(id: number) {
    if (Math.abs(id) > MAX_INT32) throw new NotFoundException(ORDER_NOT_FOUND);
    const order = await this.prisma.deviceOrder.findUnique({
      where: { id },
      include: WITH_RELATIONS,
    });
    if (!order) throw new NotFoundException(ORDER_NOT_FOUND);
    return order;
  }

  private async findPendingOrder(id: number) {
    const order = await this.findOrder(id);
    if (order.status !== ORDER_STATUS.PENDING)
      throw new BadRequestException(ORDER_ALREADY_DECIDED);
    return order;
  }
}
