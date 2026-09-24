import type {
  Department,
  Device,
  DeviceAccessory,
  DeviceOrder,
  DeviceOrderItem,
  DeviceType,
  PasswordResetToken,
  Role,
  User,
} from '@prisma/client';

// Prisma giả trong RAM cho test: chỉ hỗ trợ đúng những toán tử code đang dùng
// (so bằng, `not`, `contains` không phân biệt hoa thường, `OR`, `include` role/department/
// deviceType/currentUser/accessories, `select` phẳng ở user.findMany).

type Where = Record<string, unknown>;
type Include = { role?: boolean; department?: boolean };
type Select = Record<string, boolean>;
type DeviceInclude = {
  deviceType?: boolean;
  department?: boolean;
  currentUser?: boolean;
  accessories?: boolean;
};
type DeviceWithRelations = Device & {
  deviceType?: DeviceType;
  department?: Department | null;
  currentUser?: User | null;
  accessories?: DeviceAccessory[];
};
type AccessoryCreateInput = Omit<DeviceAccessory, 'id' | 'deviceId'>;
type DeviceCreateData = Pick<
  Device,
  | 'deviceCode'
  | 'deviceName'
  | 'specDetail'
  | 'unit'
  | 'deviceTypeId'
  | 'status'
> &
  Partial<Device> & { accessories?: { create: AccessoryCreateInput[] } };
type DeviceUpdateData = Partial<Device> & {
  accessories?: { deleteMany: object; create: AccessoryCreateInput[] };
};
type OrderInclude = {
  targetUser?: boolean;
  createdBy?: boolean;
  decidedBy?: boolean;
  // device-orders.service.ts dùng include lồng đúng chuẩn Prisma cho quan hệ 1 cấp sâu hơn:
  // items: { include: { device: { include: DEVICE_WITH_RELATIONS } } } — nên `device` ở đây
  // là { include: DeviceInclude }, không phải DeviceInclude trực tiếp.
  items?: { include?: { device?: { include?: DeviceInclude } } };
};
type OrderWithRelations = DeviceOrder & {
  targetUser?: User;
  createdBy?: User;
  decidedBy?: User | null;
  items?: (DeviceOrderItem & { device?: DeviceWithRelations })[];
};
type OrderItemCreateInput = { deviceId: number };
type OrderCreateData = Pick<
  DeviceOrder,
  'type' | 'targetUserId' | 'createdById'
> &
  Partial<DeviceOrder> & { items?: { create: OrderItemCreateInput[] } };

function matchValue(value: unknown, cond: unknown): boolean {
  if (cond === undefined) return true; // Prisma bỏ qua điều kiện undefined
  if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
    const c = cond as { not?: unknown; contains?: string; in?: unknown[] };
    if ('not' in c) return value !== c.not;
    if ('in' in c && Array.isArray(c.in)) return c.in.includes(value);
    if (typeof c.contains === 'string') {
      return String(value).toLowerCase().includes(c.contains.toLowerCase());
    }
  }
  return value === cond;
}

export function matches(row: object, where: Where = {}): boolean {
  return Object.entries(where).every(([key, cond]) =>
    key === 'OR'
      ? (cond as Where[]).some((w) => matches(row, w))
      : matchValue((row as Record<string, unknown>)[key], cond),
  );
}

/** Giả lập `select` phẳng của Prisma: chỉ giữ lại đúng các cột được chọn. */
function project(row: object, select?: Select) {
  if (!select) return row;
  return Object.fromEntries(Object.entries(row).filter(([k]) => select[k]));
}

export function createFakePrisma() {
  const roles: Role[] = [
    { id: 1, roleName: 'Quản trị viên' },
    { id: 2, roleName: 'Trưởng phòng' },
    { id: 3, roleName: 'Nhân viên' },
  ];
  const departments: Department[] = [
    { id: 1, departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' },
    { id: 2, departmentCode: 'KETOAN', departmentName: 'Phòng Kế toán' },
  ];
  const users: User[] = [];
  const tokens: PasswordResetToken[] = [];
  const deviceTypes: DeviceType[] = [
    { id: 1, typeName: 'Laptop', prefix: 'LT' },
    { id: 2, typeName: 'Máy tính để bàn', prefix: 'PC' },
  ];
  const devices: Device[] = [];
  const deviceAccessories: DeviceAccessory[] = [];
  const deviceOrders: DeviceOrder[] = [];
  const deviceOrderItems: DeviceOrderItem[] = [];

  const forbidden = () => {
    throw new Error('Không được xoá cứng dữ liệu');
  };
  const withRelations = (user: User, include?: Include) =>
    include
      ? {
          ...user,
          ...(include.role && {
            role: roles.find((r) => r.id === user.roleId)!,
          }),
          ...(include.department && {
            department:
              departments.find((d) => d.id === user.departmentId) ?? null,
          }),
        }
      : user;
  const withDeviceRelations = (
    d: Device,
    include?: DeviceInclude,
  ): DeviceWithRelations =>
    include
      ? {
          ...d,
          ...(include.deviceType && {
            deviceType: deviceTypes.find((t) => t.id === d.deviceTypeId)!,
          }),
          ...(include.department && {
            department:
              departments.find((x) => x.id === d.departmentId) ?? null,
          }),
          ...(include.currentUser && {
            currentUser: users.find((u) => u.id === d.currentUserId) ?? null,
          }),
          ...(include.accessories && {
            accessories: deviceAccessories.filter((a) => a.deviceId === d.id),
          }),
        }
      : d;
  const withOrderRelations = (
    o: DeviceOrder,
    include?: OrderInclude,
  ): OrderWithRelations =>
    include
      ? {
          ...o,
          ...(include.targetUser && {
            targetUser: users.find((u) => u.id === o.targetUserId)!,
          }),
          ...(include.createdBy && {
            createdBy: users.find((u) => u.id === o.createdById)!,
          }),
          ...(include.decidedBy && {
            decidedBy: users.find((u) => u.id === o.decidedById) ?? null,
          }),
          ...(include.items && {
            items: deviceOrderItems
              .filter((i) => i.orderId === o.id)
              .map((i) => ({
                ...i,
                ...(include.items!.include?.device && {
                  device: withDeviceRelations(
                    devices.find((d) => d.id === i.deviceId)!,
                    include.items!.include.device.include,
                  ),
                }),
              })),
          }),
        }
      : o;

  const prisma = {
    users,
    tokens,
    roles,
    departments,
    devices,
    deviceTypes,
    deviceAccessories,
    deviceOrders,
    deviceOrderItems,
    user: {
      findFirst: jest.fn(
        async ({ where, include }: { where: Where; include?: Include }) => {
          const hit = users.find((u) => matches(u, where));
          return hit ? withRelations(hit, include) : null;
        },
      ),
      findUnique: jest.fn(
        async ({ where, include }: { where: Where; include?: Include }) => {
          const hit = users.find((u) => matches(u, where));
          return hit ? withRelations(hit, include) : null;
        },
      ),
      findMany: jest.fn(
        async ({
          where,
          include,
          select,
        }: {
          where?: Where;
          include?: Include;
          select?: Select;
        }) =>
          users
            .filter((u) => matches(u, where))
            .map((u) => project(withRelations(u, include), select)),
      ),
      create: jest.fn(
        async ({
          data,
          include,
        }: {
          data: Omit<
            User,
            | 'id'
            | 'createdAt'
            | 'updatedAt'
            | 'status'
            | 'isVerified'
            | 'departmentId'
          > &
            Partial<User>;
          include?: Include;
        }) => {
          const now = new Date();
          const row: User = {
            id: users.length + 1,
            status: 'Đang hoạt động',
            isVerified: false,
            departmentId: null,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          users.push(row);
          return withRelations(row, include);
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
          include,
        }: {
          where: Where;
          data: Partial<User>;
          include?: Include;
        }) => {
          const row = users.find((u) => matches(u, where))!;
          Object.assign(row, data, { updatedAt: new Date() });
          return withRelations(row, include);
        },
      ),
      delete: jest.fn(forbidden),
      // Chỉ /users/purge dùng.
      deleteMany: jest.fn(async ({ where }: { where: Where }) => {
        const toRemove = users.filter((u) => matches(u, where));
        for (const u of toRemove) users.splice(users.indexOf(u), 1);
        return { count: toRemove.length };
      }),
    },
    role: {
      findUnique: jest.fn(
        async ({ where }: { where: Where }) =>
          roles.find((r) => matches(r, where)) ?? null,
      ),
      findMany: jest.fn(async () => [...roles]),
    },
    department: {
      findUnique: jest.fn(
        async ({ where }: { where: Where }) =>
          departments.find((d) => matches(d, where)) ?? null,
      ),
      findMany: jest.fn(async () => [...departments]),
    },
    deviceType: {
      findMany: jest.fn(async () => [...deviceTypes]),
      findUnique: jest.fn(
        async ({ where }: { where: Where }) =>
          deviceTypes.find((t) => matches(t, where)) ?? null,
      ),
    },
    device: {
      findMany: jest.fn(
        async ({ where, include }: { where: Where; include?: DeviceInclude }) =>
          devices
            .filter((d) => matches(d, where))
            .sort((a, b) => a.id - b.id)
            .map((d) => withDeviceRelations(d, include)),
      ),
      findUnique: jest.fn(
        async ({
          where,
          include,
        }: {
          where: Where;
          include?: DeviceInclude;
        }) => {
          const hit = devices.find((d) => matches(d, where));
          return hit ? withDeviceRelations(hit, include) : null;
        },
      ),
      create: jest.fn(
        async ({
          data,
          include,
        }: {
          data: DeviceCreateData;
          include?: DeviceInclude;
        }) => {
          const { accessories, ...rest } = data;
          const now = new Date();
          const row: Device = {
            id: devices.length + 1,
            serialNumber: null,
            location: null,
            purchaseDate: null,
            supplier: null,
            warrantyMonths: null,
            warrantyCondition: null,
            warrantyExpiresOn: null,
            allocatedOn: null,
            departmentId: null,
            currentUserId: null,
            createdAt: now,
            updatedAt: now,
            ...rest,
          };
          devices.push(row);
          for (const a of accessories?.create ?? []) {
            deviceAccessories.push({
              id: deviceAccessories.length + 1,
              deviceId: row.id,
              ...a,
            });
          }
          return withDeviceRelations(row, include);
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
          include,
        }: {
          where: Where;
          data: DeviceUpdateData;
          include?: DeviceInclude;
        }) => {
          const row = devices.find((d) => matches(d, where))!;
          const { accessories, ...rest } = data;
          for (const [k, v] of Object.entries(rest)) {
            if (v !== undefined) (row as Record<string, unknown>)[k] = v;
          }
          if (accessories) {
            for (let i = deviceAccessories.length - 1; i >= 0; i--) {
              if (deviceAccessories[i].deviceId === row.id) {
                deviceAccessories.splice(i, 1);
              }
            }
            for (const a of accessories.create) {
              deviceAccessories.push({
                id: deviceAccessories.length + 1,
                deviceId: row.id,
                ...a,
              });
            }
          }
          return withDeviceRelations(row, include);
        },
      ),
      // Chỉ device-orders.service.ts (approve()) dùng — ghi có điều kiện để chặn 2 đơn cùng
      // nhắm 1 thiết bị ghi đè nhau khi duyệt gần như đồng thời.
      updateMany: jest.fn(
        async ({ where, data }: { where: Where; data: Partial<Device> }) => {
          const hit = devices.filter((d) => matches(d, where));
          hit.forEach((d) => Object.assign(d, data));
          return { count: hit.length };
        },
      ),
      delete: jest.fn(forbidden),
      // Chỉ /devices/purge dùng — CASCADE deviceAccessories giống FK thật trong migration.
      deleteMany: jest.fn(async ({ where }: { where: Where }) => {
        const toRemove = devices.filter((d) => matches(d, where));
        for (const d of toRemove) {
          devices.splice(devices.indexOf(d), 1);
          for (let i = deviceAccessories.length - 1; i >= 0; i--) {
            if (deviceAccessories[i].deviceId === d.id)
              deviceAccessories.splice(i, 1);
          }
        }
        return { count: toRemove.length };
      }),
    },
    deviceOrder: {
      findMany: jest.fn(
        async ({
          where,
          include,
          select,
        }: {
          where?: Where;
          include?: OrderInclude;
          select?: Select;
        }) =>
          deviceOrders
            .filter((o) => matches(o, where))
            .sort((a, b) => b.id - a.id)
            .map((o) => project(withOrderRelations(o, include), select)),
      ),
      findUnique: jest.fn(
        async ({
          where,
          include,
        }: {
          where: Where;
          include?: OrderInclude;
        }) => {
          const hit = deviceOrders.find((o) => matches(o, where));
          return hit ? withOrderRelations(hit, include) : null;
        },
      ),
      create: jest.fn(
        async ({
          data,
          include,
        }: {
          data: OrderCreateData;
          include?: OrderInclude;
        }) => {
          const { items, ...rest } = data;
          const row: DeviceOrder = {
            id: deviceOrders.length + 1,
            status: 'Chờ duyệt',
            note: null,
            decidedById: null,
            decidedAt: null,
            rejectReason: null,
            createdAt: new Date(),
            ...rest,
          };
          deviceOrders.push(row);
          for (const item of items?.create ?? []) {
            deviceOrderItems.push({
              id: deviceOrderItems.length + 1,
              orderId: row.id,
              ...item,
            });
          }
          return withOrderRelations(row, include);
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
          include,
        }: {
          where: Where;
          data: Partial<DeviceOrder>;
          include?: OrderInclude;
        }) => {
          const row = deviceOrders.find((o) => matches(o, where))!;
          Object.assign(row, data);
          return withOrderRelations(row, include);
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Where;
          data: Partial<DeviceOrder>;
        }) => {
          const hit = deviceOrders.filter((o) => matches(o, where));
          hit.forEach((o) => Object.assign(o, data));
          return { count: hit.length };
        },
      ),
      delete: jest.fn(forbidden),
    },
    // Chỉ /devices/purge dùng — RESTRICT thật trong schema (DeviceOrderItem.deviceId) nên phải
    // biết thiết bị nào còn bị tham chiếu trước khi xoá cứng Device.
    deviceOrderItem: {
      findMany: jest.fn(async ({ where }: { where?: Where }) =>
        deviceOrderItems.filter((i) => matches(i, where)),
      ),
    },
    passwordResetToken: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: Pick<PasswordResetToken, 'userId' | 'tokenHash' | 'expiresAt'>;
        }) => {
          const row = {
            id: tokens.length + 1,
            usedAt: null,
            createdAt: new Date(),
            ...data,
          };
          tokens.push(row);
          return row;
        },
      ),
      findFirst: jest.fn(
        async ({ where }: { where: Where }) =>
          [...tokens].reverse().find((t) => matches(t, where)) ?? null,
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Where;
          data: Partial<PasswordResetToken>;
        }) => {
          const hit = tokens.filter((t) => matches(t, where));
          hit.forEach((t) => Object.assign(t, data));
          return { count: hit.length };
        },
      ),
      delete: jest.fn(forbidden),
      // Chỉ /users/purge dùng — RESTRICT thật trong migration nên phải xoá trước khi xoá User.
      deleteMany: jest.fn(async ({ where }: { where: Where }) => {
        const toRemove = tokens.filter((t) => matches(t, where));
        for (const t of toRemove) tokens.splice(tokens.indexOf(t), 1);
        return { count: toRemove.length };
      }),
    },
    // Kiểu trả về khai báo tường minh để cắt vòng suy luận kiểu (lỗi TS7022/TS7024 cũ).
    $transaction: jest.fn(
      async (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
        fn(prisma),
    ),
  };
  return prisma;
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
