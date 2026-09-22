import type {
  Department,
  PasswordResetToken,
  Role,
  User,
} from '@prisma/client';

// Prisma giả trong RAM cho test: chỉ hỗ trợ đúng những toán tử code đang dùng
// (so bằng, `not`, `contains` không phân biệt hoa thường, `OR`, `include` role/department).

type Where = Record<string, unknown>;
type Include = { role?: boolean; department?: boolean };

function matchValue(value: unknown, cond: unknown): boolean {
  if (cond === undefined) return true; // Prisma bỏ qua điều kiện undefined
  if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
    const c = cond as { not?: unknown; contains?: string };
    if ('not' in c) return value !== c.not;
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

  const prisma = {
    users,
    tokens,
    roles,
    departments,
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
        async ({ where, include }: { where?: Where; include?: Include }) =>
          users
            .filter((u) => matches(u, where))
            .map((u) => withRelations(u, include)),
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
      deleteMany: jest.fn(forbidden),
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
      deleteMany: jest.fn(forbidden),
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
