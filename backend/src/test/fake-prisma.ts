import type {
  Audit,
  AuditItem,
  AuditItemAccessory,
  AuditMember,
  AuditSummary,
  AuditSummaryAudit,
  Department,
  Device,
  DeviceAccessory,
  DeviceOrder,
  DeviceOrderItem,
  DeviceTransfer,
  DeviceTransferItem,
  DeviceType,
  PasswordResetToken,
  Role,
  User,
} from '@prisma/client';

// Prisma giả trong RAM cho test: chỉ hỗ trợ đúng những toán tử code đang dùng
// (so bằng, `not`, `contains` không phân biệt hoa thường, `OR`, `include` role/department/
// deviceType/currentUser/accessories, audit/summary lồng nhau, `select` phẳng ở user.findMany).

type Where = Record<string, unknown>;
type Include = { role?: boolean; department?: boolean };
type Select = Record<string, boolean>;
type DeviceInclude = {
  deviceType?: boolean;
  currentUser?: boolean;
  accessories?: boolean;
};
type DeviceWithRelations = Device & {
  deviceType?: DeviceType;
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
type TransferInclude = {
  fromUser?: boolean;
  toUser?: boolean;
  createdBy?: boolean;
  decidedBy?: boolean;
  items?: { include?: { device?: { include?: DeviceInclude } } };
};
type TransferWithRelations = DeviceTransfer & {
  fromUser?: User;
  toUser?: User;
  createdBy?: User;
  decidedBy?: User | null;
  items?: (DeviceTransferItem & { device?: DeviceWithRelations })[];
};
type TransferItemCreateInput = { deviceId: number };
type TransferCreateData = Pick<
  DeviceTransfer,
  'fromUserId' | 'toUserId' | 'createdById'
> &
  Partial<DeviceTransfer> & { items?: { create: TransferItemCreateInput[] } };

type AuditItemIncludeArg = {
  include?: { accessories?: boolean };
  orderBy?: unknown;
};
type AuditInclude = {
  createdBy?: boolean;
  decidedBy?: boolean;
  deviceType?: boolean;
  members?: { include?: { user?: boolean } };
  items?: boolean | AuditItemIncludeArg;
};
type AccessoryLineCreate = Pick<
  AuditItemAccessory,
  'accessoryCode' | 'accessoryName' | 'accessoryType' | 'unit'
>;
type AuditItemCreate = Omit<AuditItem, 'id' | 'auditId' | 'result' | 'note'> & {
  accessories?: { create: AccessoryLineCreate[] };
};
type AuditCreateData = Pick<
  Audit,
  'unitName' | 'dueDate' | 'purpose' | 'createdById'
> &
  Partial<Audit> & {
    items?: { create: AuditItemCreate[] };
    members?: { create: { userId: number }[] };
  };
type SummaryAuditsArg = {
  include?: { audit?: boolean | { include?: AuditInclude } };
};
type SummaryInclude = {
  createdBy?: boolean;
  audits?: boolean | SummaryAuditsArg;
};
type SummaryCreateData = Pick<AuditSummary, 'title' | 'createdById'> &
  Partial<AuditSummary> & { audits?: { create: { auditId: number }[] } };

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

/** Tách bộ lọc quan hệ (`audit` / `auditItem`) khỏi where phẳng, rồi kiểm tra trên dòng cha. */
function relationOk(
  where: Where,
  key: string,
  parents: object[],
  fk: string,
  row: object,
): boolean {
  const rel = where[key];
  if (!rel) return true;
  const parent = parents.find(
    (p) => (p as { id: number }).id === (row as Record<string, number>)[fk],
  );
  return !!parent && matches(parent, rel as Where);
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
    { id: 4, roleName: 'Chuyên viên' },
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
  const deviceTransfers: DeviceTransfer[] = [];
  const deviceTransferItems: DeviceTransferItem[] = [];
  const audits: Audit[] = [];
  const auditItems: AuditItem[] = [];
  const auditItemAccessories: AuditItemAccessory[] = [];
  const auditMembers: AuditMember[] = [];
  const auditSummaries: AuditSummary[] = [];
  const auditSummaryAudits: AuditSummaryAudit[] = [];

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
  const withTransferRelations = (
    t: DeviceTransfer,
    include?: TransferInclude,
  ): TransferWithRelations =>
    include
      ? {
          ...t,
          ...(include.fromUser && {
            fromUser: users.find((u) => u.id === t.fromUserId)!,
          }),
          ...(include.toUser && {
            toUser: users.find((u) => u.id === t.toUserId)!,
          }),
          ...(include.createdBy && {
            createdBy: users.find((u) => u.id === t.createdById)!,
          }),
          ...(include.decidedBy && {
            decidedBy: users.find((u) => u.id === t.decidedById) ?? null,
          }),
          ...(include.items && {
            items: deviceTransferItems
              .filter((i) => i.transferId === t.id)
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
      : t;

  const withAuditItem = (i: AuditItem, arg?: AuditItemIncludeArg) =>
    arg?.include?.accessories
      ? {
          ...i,
          accessories: auditItemAccessories.filter(
            (x) => x.auditItemId === i.id,
          ),
        }
      : i;
  // Kiểu trả về `object` tường minh để cắt vòng suy luận kiểu (withSummaryRelations gọi lại hàm này).
  const withAuditRelations = (a: Audit, include?: AuditInclude): object => {
    if (!include) return a;
    const itemsArg =
      include.items === true
        ? undefined
        : (include.items as AuditItemIncludeArg | undefined);
    return {
      ...a,
      ...(include.createdBy && {
        createdBy: users.find((u) => u.id === a.createdById)!,
      }),
      ...(include.decidedBy && {
        decidedBy: users.find((u) => u.id === a.decidedById) ?? null,
      }),
      ...(include.deviceType && {
        deviceType: deviceTypes.find((t) => t.id === a.deviceTypeId) ?? null,
      }),
      ...(include.members && {
        members: auditMembers
          .filter((m) => m.auditId === a.id)
          .map((m) =>
            include.members!.include?.user
              ? { ...m, user: users.find((u) => u.id === m.userId)! }
              : m,
          ),
      }),
      ...(include.items && {
        items: auditItems
          .filter((i) => i.auditId === a.id)
          .sort((x, y) => x.id - y.id)
          .map((i) => withAuditItem(i, itemsArg)),
      }),
    };
  };
  const withSummaryRelations = (
    s: AuditSummary,
    include?: SummaryInclude,
  ): object => {
    if (!include) return s;
    const auditArg =
      include.audits === true
        ? undefined
        : (include.audits as SummaryAuditsArg | undefined)?.include?.audit;
    return {
      ...s,
      ...(include.createdBy && {
        createdBy: users.find((u) => u.id === s.createdById)!,
      }),
      ...(include.audits && {
        audits: auditSummaryAudits
          .filter((l) => l.summaryId === s.id)
          .map((l) =>
            auditArg
              ? {
                  ...l,
                  audit: withAuditRelations(
                    audits.find((a) => a.id === l.auditId)!,
                    auditArg === true ? undefined : auditArg.include,
                  ),
                }
              : l,
          ),
      }),
    };
  };
  const updateRows = <T extends object>(
    rows: T[],
    where: Where,
    data: Partial<T>,
  ) => {
    const hit = rows.filter((r) => matches(r, where));
    for (const r of hit) {
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) (r as Record<string, unknown>)[k] = v;
      }
    }
    return hit;
  };

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
    deviceTransfers,
    deviceTransferItems,
    audits,
    auditItems,
    auditItemAccessories,
    auditMembers,
    auditSummaries,
    auditSummaryAudits,
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
    deviceTransfer: {
      findMany: jest.fn(
        async ({
          where,
          include,
          select,
        }: {
          where?: Where;
          include?: TransferInclude;
          select?: Select;
        }) =>
          deviceTransfers
            .filter((t) => matches(t, where))
            .sort((a, b) => b.id - a.id)
            .map((t) => project(withTransferRelations(t, include), select)),
      ),
      findUnique: jest.fn(
        async ({
          where,
          include,
        }: {
          where: Where;
          include?: TransferInclude;
        }) => {
          const hit = deviceTransfers.find((t) => matches(t, where));
          return hit ? withTransferRelations(hit, include) : null;
        },
      ),
      create: jest.fn(
        async ({
          data,
          include,
        }: {
          data: TransferCreateData;
          include?: TransferInclude;
        }) => {
          const { items, ...rest } = data;
          const row: DeviceTransfer = {
            id: deviceTransfers.length + 1,
            status: 'Chờ duyệt',
            note: null,
            decidedById: null,
            decidedAt: null,
            rejectReason: null,
            createdAt: new Date(),
            ...rest,
          };
          deviceTransfers.push(row);
          for (const item of items?.create ?? []) {
            deviceTransferItems.push({
              id: deviceTransferItems.length + 1,
              transferId: row.id,
              ...item,
            });
          }
          return withTransferRelations(row, include);
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Where;
          data: Partial<DeviceTransfer>;
        }) => {
          const hit = deviceTransfers.filter((t) => matches(t, where));
          hit.forEach((t) => Object.assign(t, data));
          return { count: hit.length };
        },
      ),
      delete: jest.fn(forbidden),
    },
    // Chỉ /devices/purge dùng — RESTRICT thật trong schema (DeviceTransferItem.deviceId).
    deviceTransferItem: {
      findMany: jest.fn(async ({ where }: { where?: Where }) =>
        deviceTransferItems.filter((i) => matches(i, where)),
      ),
    },
    audit: {
      findMany: jest.fn(
        async ({
          where,
          include,
          select,
        }: {
          where?: Where;
          include?: AuditInclude;
          select?: Select;
          orderBy?: unknown;
        }) =>
          audits
            .filter((a) => matches(a, where))
            .sort((a, b) => b.id - a.id)
            .map((a) => project(withAuditRelations(a, include), select)),
      ),
      findUnique: jest.fn(
        async ({
          where,
          include,
        }: {
          where: Where;
          include?: AuditInclude;
        }) => {
          const hit = audits.find((a) => matches(a, where));
          return hit ? withAuditRelations(hit, include) : null;
        },
      ),
      create: jest.fn(
        async ({
          data,
          include,
        }: {
          data: AuditCreateData;
          include?: AuditInclude;
        }) => {
          const { items, members, ...rest } = data;
          const row: Audit = {
            id: audits.length + 1,
            status: 'Chưa kiểm kê',
            departmentId: null,
            deviceTypeId: null,
            location: null,
            startedAt: null,
            submittedAt: null,
            decidedById: null,
            decidedAt: null,
            rejectReason: null,
            createdAt: new Date(),
            ...rest,
          };
          audits.push(row);
          for (const { accessories, ...item } of items?.create ?? []) {
            const itemRow: AuditItem = {
              id: auditItems.length + 1,
              auditId: row.id,
              result: null,
              note: null,
              ...item,
            };
            auditItems.push(itemRow);
            for (const acc of accessories?.create ?? []) {
              auditItemAccessories.push({
                id: auditItemAccessories.length + 1,
                auditItemId: itemRow.id,
                result: null,
                note: null,
                ...acc,
              });
            }
          }
          for (const m of members?.create ?? []) {
            auditMembers.push({ auditId: row.id, userId: m.userId });
          }
          return withAuditRelations(row, include);
        },
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: Where; data: Partial<Audit> }) => ({
          count: updateRows(audits, where, data).length,
        }),
      ),
      delete: jest.fn(forbidden),
    },
    auditItem: {
      findMany: jest.fn(
        async ({ where, select }: { where?: Where; select?: Select }) =>
          auditItems
            .filter((i) => matches(i, where))
            .map((i) => project(i, select)),
      ),
      update: jest.fn(
        async ({ where, data }: { where: Where; data: Partial<AuditItem> }) =>
          updateRows(auditItems, where, data)[0],
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: Where; data: Partial<AuditItem> }) => {
          const { audit: _a, ...flat } = where;
          void _a;
          const ok = auditItems.filter((i) =>
            relationOk(where, 'audit', audits, 'auditId', i),
          );
          return { count: updateRows(ok, flat, data).length };
        },
      ),
    },
    auditItemAccessory: {
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Where;
          data: Partial<AuditItemAccessory>;
        }) => updateRows(auditItemAccessories, where, data)[0],
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Where;
          data: Partial<AuditItemAccessory>;
        }) => {
          const { auditItem: _ai, ...flat } = where;
          void _ai;
          const rel = (where.auditItem ?? {}) as Where;
          const { audit: _au, ...relFlat } = rel;
          void _au;
          const ok = auditItemAccessories.filter((a) => {
            const parent = auditItems.find((i) => i.id === a.auditItemId);
            return (
              !!parent &&
              matches(parent, relFlat) &&
              relationOk(rel, 'audit', audits, 'auditId', parent)
            );
          });
          return { count: updateRows(ok, flat, data).length };
        },
      ),
    },
    auditMember: {
      findMany: jest.fn(
        async ({ where, select }: { where?: Where; select?: Select }) =>
          auditMembers
            .filter((m) => matches(m, where))
            .map((m) => project(m, select)),
      ),
      // Chỉ PUT /audits/:id/members dùng — thay toàn bộ danh sách thành viên của 1 đợt.
      deleteMany: jest.fn(async ({ where }: { where: Where }) => {
        const toRemove = auditMembers.filter((m) => matches(m, where));
        for (const m of toRemove)
          auditMembers.splice(auditMembers.indexOf(m), 1);
        return { count: toRemove.length };
      }),
      createMany: jest.fn(async ({ data }: { data: AuditMember[] }) => {
        auditMembers.push(...data);
        return { count: data.length };
      }),
    },
    auditSummary: {
      findMany: jest.fn(
        async ({
          where,
          include,
          select,
        }: {
          where?: Where;
          include?: SummaryInclude;
          select?: Select;
          orderBy?: unknown;
        }) =>
          auditSummaries
            .filter((s) => matches(s, where))
            .sort((a, b) => b.id - a.id)
            .map((s) => project(withSummaryRelations(s, include), select)),
      ),
      findUnique: jest.fn(
        async ({
          where,
          include,
        }: {
          where: Where;
          include?: SummaryInclude;
        }) => {
          const hit = auditSummaries.find((s) => matches(s, where));
          return hit ? withSummaryRelations(hit, include) : null;
        },
      ),
      create: jest.fn(
        async ({
          data,
          include,
        }: {
          data: SummaryCreateData;
          include?: SummaryInclude;
        }) => {
          const { audits: links, ...rest } = data;
          const row: AuditSummary = {
            id: auditSummaries.length + 1,
            purpose: null,
            createdAt: new Date(),
            ...rest,
          };
          auditSummaries.push(row);
          for (const l of links?.create ?? []) {
            auditSummaryAudits.push({ summaryId: row.id, auditId: l.auditId });
          }
          return withSummaryRelations(row, include);
        },
      ),
      delete: jest.fn(forbidden),
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
