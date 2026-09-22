# User Management + JWT Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin quản lý tài khoản (danh sách/tìm/lọc, tạo, khoá/mở khoá, xoá mềm) qua API có JWT guard; FE gửi token, tự đăng xuất khi 401/hết hạn; tài liệu cập nhật báo cáo ở `docs/Changes.md`.

**Architecture:** BE thêm guard dùng chung (`src/shared/auth/`) verify JWT rồi đọc User+Role từ DB mỗi request, và module `users` (Nest thường). FE tổng quát `apiClient` (Authorization + 401 hook do `SessionProvider` đăng ký), thêm màn quản lý vào module `user` theo 4 lớp DDD. Ba track độc lập (BE / FE / Docs), mỗi track 1 worktree + 1 nhánh, chỉ giao nhau qua API contract cố định dưới đây.

**Tech Stack:** NestJS 11.2, Prisma 7.10 (`prisma-client-js` + `@prisma/adapter-pg`), class-validator/class-transformer, Jest 30 + supertest · React 18, react-router-dom 6, Vite 5, Vitest 2 + Testing Library, Tailwind 3.

**Spec:** `docs/superpowers/specs/2026-09-19-user-management-design.md`

## Global Constraints

- Mọi chuỗi hiển thị / message lỗi bằng **tiếng Việt**, đúng từng chữ như bảng contract.
- Envelope BE giữ nguyên `{ success, data, error, message }`; FE luôn bóc `data`, đọc lỗi ở `message`.
- **Không đổi `backend/prisma/schema.prisma`, không tạo migration.**
- Không bao giờ xoá cứng `User` (không gọi `user.delete`/`deleteMany`).
- Không trả `password` trong bất kỳ response nào.
- Status chỉ 3 giá trị: `"Đang hoạt động"`, `"Ngừng hoạt động"`, `"Đã xóa"`.
- Role names: `"Quản trị viên"`, `"Trưởng phòng"`, `"Nhân viên"`.
- Không thêm dependency mới (FE lẫn BE).
- `backend/` là project pnpm riêng: chạy lệnh trong `backend/` bằng `npx -y pnpm@10 <cmd>` (máy không có pnpm global). FE chạy từ gốc repo bằng `npm ... -w frontend` hoặc trong `frontend/`.
- FE test dùng `MemoryRouter`, không dùng data router (lỗi AbortSignal trên Node 25).
- Chỉ commit trên nhánh worktree của track. **Không** commit/merge vào `main`, **không** push.
- Commit message: conventional commits, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## API Contract (cố định — nguồn chung của Track A và Track B)

| Endpoint | Quyền | Input | Thành công | Lỗi |
|---|---|---|---|---|
| `POST /auth/login` | công khai | như cũ | `data.user` thêm `roleName: string` | như cũ |
| `GET /users` | Admin | query `search?`, `status?`, `roleId?`, `departmentId?` — không có `status` → loại "Đã xóa"; `search` khớp username/fullName/email không phân biệt hoa thường | 200 `UserListItem[]` theo `id` tăng, message "Thành công" | 400 query sai |
| `POST /users` | Admin | `{ username, email, fullName, password, roleId, departmentId? }` | **201** `UserListItem`, "Đã tạo người dùng" | 409 "Tên đăng nhập đã tồn tại" / "Email đã tồn tại"; 400 "Vai trò không tồn tại" / "Phòng ban không tồn tại" / lỗi validate |
| `PATCH /users/:id/status` | Admin | `{ status: "Đang hoạt động" \| "Ngừng hoạt động" }` | 200 `UserListItem`, "Đã cập nhật trạng thái" | 404 "Người dùng không tồn tại" (gồm cả đã xoá, id không phải số); 400 "Không thể tự khoá tài khoản của mình" |
| `DELETE /users/:id` | Admin | — | 200 `data: null`, "Đã xoá người dùng" | 404 "Người dùng không tồn tại"; 400 "Không thể tự xoá tài khoản của mình" |
| `GET /roles` | đã đăng nhập | — | `{ id, roleName }[]` theo id | |
| `GET /departments` | đã đăng nhập | — | `{ id, departmentCode, departmentName }[]` theo id | |

```ts
type UserListItem = {
  id: number; username: string; fullName: string; email: string;
  status: string; isVerified: boolean; createdAt: string;
  role: { id: number; roleName: string };
  department: { id: number; departmentCode: string; departmentName: string } | null;
};
```
Thiếu/sai/hết hạn token, hoặc user của token không tồn tại / không "Đang hoạt động" → **401 "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại"**. Sai role → **403 "Bạn không có quyền thực hiện thao tác này"**.

## Execution Layout

| Track | Worktree branch (từ `main`) | Tasks | Chạy song song |
|---|---|---|---|
| A — Backend | `wt/be-users` | A1 → A5 | ✔ |
| B — Frontend | `wt/fe-users` | B1 → B6 | ✔ |
| C — Docs | `wt/docs-changes` | C1 | ✔ |
| Integration (main thread) | `feat/user-management` | I1 → I3 | sau khi A, B, C xong |

Worktree tạo bằng skill `superpowers:using-git-worktrees`. Mỗi worktree phải cài deps riêng: Track A `cd backend && npx -y pnpm@10 install && npx prisma generate`; Track B `npm install` ở gốc worktree. Test BE không cần DB và tự set `JWT_SECRET`/`JWT_EXPIRES_IN`.

---

# Track A — Backend (`wt/be-users`)

## File map

| File | Trách nhiệm |
|---|---|
| Create `backend/src/test/fake-prisma.ts` | Prisma giả trong RAM dùng chung cho mọi spec (where/include/OR/contains/not) |
| Modify `backend/src/modules/identity/auth.spec.ts` | Dùng fake chung; sửa 2 lỗi tsc; test `roleName`, `isVerified` |
| Modify `backend/tsconfig.build.json`, `backend/eslint.config.mjs` | Loại `src/test` khỏi build; nới lint cho helper test |
| Create `backend/src/modules/identity/roles.ts` | Hằng số tên role |
| Create `backend/src/shared/auth/auth.module.ts` | `@Global` JwtModule (chuyển từ identity) |
| Create `backend/src/shared/auth/auth.guard.ts` | Guard JWT + DB + role; kiểu `JwtPayload`, `AuthedRequest` |
| Create `backend/src/shared/auth/roles.decorator.ts` | `@Roles(...)` |
| Modify `backend/src/modules/identity/identity.module.ts`, `auth.service.ts`, `password-reset.service.ts`, `auth.dto.ts` | Bỏ JwtModule cục bộ; login trả `roleName`; reset set `isVerified`; export `PASSWORD_MIN_LENGTH` |
| Modify `backend/src/app.module.ts`, `backend/src/app.setup.ts` | Import AuthModule/UsersModule; `ValidationPipe({ whitelist, transform })` |
| Create `backend/src/modules/users/{users.module,users.controller,users.service,users.dto}.ts` | API quản lý user + `/roles` `/departments` |
| Create `backend/src/modules/users/users.spec.ts` | Test e2e module users |
| Modify `backend/prisma/seed.ts` | 3 role, 2 phòng ban, admin không phòng ban |

### Task A1: Fake Prisma dùng chung + sửa lỗi tsc

**Files:**
- Create: `backend/src/test/fake-prisma.ts`
- Modify: `backend/src/modules/identity/auth.spec.ts:1-94` (xoá `createFakePrisma`/`matches` cục bộ, import từ helper)
- Modify: `backend/tsconfig.build.json`, `backend/eslint.config.mjs`

**Interfaces:**
- Produces: `createFakePrisma()` trả object có `users: User[]`, `tokens: PasswordResetToken[]`, `roles: Role[]`, `departments: Department[]`, các delegate `user`, `role`, `department`, `passwordResetToken`, `$transaction`; kiểu `FakePrisma = ReturnType<typeof createFakePrisma>`. Seed sẵn roles `1 Quản trị viên`, `2 Trưởng phòng`, `3 Nhân viên`; departments `1 KYTHUAT Phòng Kỹ thuật`, `2 KETOAN Phòng Kế toán`.

- [ ] **Step 1: Xác nhận lỗi tsc hiện tại**

Run (trong `backend/`): `npx tsc --noEmit`
Expected: 2 lỗi `TS7022` (`auth.spec.ts(29,9)`) và `TS7024` (`auth.spec.ts(88,27)`).

- [ ] **Step 2: Tạo `backend/src/test/fake-prisma.ts`**

```ts
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
```

- [ ] **Step 3: Cho `auth.spec.ts` dùng helper**

Trong `backend/src/modules/identity/auth.spec.ts`: xoá toàn bộ khối từ `type Where = ...` tới hết `function createFakePrisma() {...}` (dòng ~18–94), thêm import:

```ts
import { createFakePrisma, type FakePrisma } from '../../test/fake-prisma';
```

Đổi `let prisma: ReturnType<typeof createFakePrisma>;` thành `let prisma: FakePrisma;`. Trong `addUser` đổi `roleId: 7` thành `roleId: 3` (role "Nhân viên" có sẵn trong fake). Trong test login đầu tiên đổi hai chỗ `roleId: 7` thành `roleId: 3`.

- [ ] **Step 4: Loại `src/test` khỏi build, nới lint cho helper**

`backend/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "src/test", "dist", "prisma", "prisma.config.ts", "**/*spec.ts"]
}
```
`backend/eslint.config.mjs`: trong block override có `files: ['**/*.spec.ts']`, đổi thành `files: ['**/*.spec.ts', 'src/test/**/*.ts']`.

- [ ] **Step 5: Chạy lại tsc + test + lint**

Run: `npx tsc --noEmit && npx -y pnpm@10 test && npx -y pnpm@10 lint`
Expected: tsc không lỗi; jest `23 passed`; lint sạch.

- [ ] **Step 6: Commit**

```bash
git add backend/src/test/fake-prisma.ts backend/src/modules/identity/auth.spec.ts backend/tsconfig.build.json backend/eslint.config.mjs
git commit -m "test(backend): share in-memory Prisma fake, fix implicit-any tsc errors"
```

### Task A2: Login trả `roleName`, reset mật khẩu set `isVerified`, JwtModule dùng chung

**Files:**
- Create: `backend/src/modules/identity/roles.ts`, `backend/src/shared/auth/auth.module.ts`
- Modify: `backend/src/modules/identity/identity.module.ts`, `auth.service.ts`, `password-reset.service.ts`, `backend/src/app.module.ts`
- Test: `backend/src/modules/identity/auth.spec.ts`

**Interfaces:**
- Consumes: `createFakePrisma` (A1).
- Produces: `ROLE = { ADMIN: 'Quản trị viên', HEAD: 'Trưởng phòng', STAFF: 'Nhân viên' } as const`; `AuthModule` (`@Global`, export `JwtModule`) — mọi module inject được `JwtService`.

- [ ] **Step 1: Viết test fail**

Trong `auth.spec.ts`, test `'đăng nhập bằng username: ...'` thêm sau `expect(res.body.data.user).toMatchObject({...})`:
```ts
      expect(res.body.data.user.roleName).toBe('Nhân viên');
```
Trong test `'luồng đầy đủ forgot → verify → reset → login: ...'`, ngay sau `expect(prisma.tokens[0].usedAt).toBeInstanceOf(Date);` thêm:
```ts
      expect(prisma.users[0].isVerified).toBe(true);
```
Và trong `addUser` đổi `isVerified: true` thành `isVerified: false` (để assert trên thật sự kiểm được thay đổi).

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx -y pnpm@10 test -- -t "đăng nhập bằng username|luồng đầy đủ"`
Expected: FAIL — `roleName` là `undefined`; `isVerified` là `false`.

- [ ] **Step 3: Implement**

`backend/src/modules/identity/roles.ts`:
```ts
// Tên role đã chốt (cột Role.RoleName). "Trưởng phòng" phân biệt Kế toán / Kỹ thuật bằng User.DepartmentId.
export const ROLE = {
  ADMIN: 'Quản trị viên',
  HEAD: 'Trưởng phòng',
  STAFF: 'Nhân viên',
} as const;
```

`backend/src/shared/auth/auth.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';

/** JwtModule dùng chung: identity ký token, AuthGuard ở mọi module verify token. */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow('JWT_EXPIRES_IN') as NonNullable<
            JwtModuleOptions['signOptions']
          >['expiresIn'],
        },
      }),
    }),
  ],
  exports: [JwtModule],
})
export class AuthModule {}
```

`backend/src/modules/identity/identity.module.ts` thay toàn bộ:
```ts
import { Module } from '@nestjs/common';
import { MailService } from '../../shared/mail/mail.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordResetService, MailService],
})
export class IdentityModule {}
```

`backend/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdentityModule } from './modules/identity/identity.module';
import { AuthModule } from './shared/auth/auth.module';
import { PrismaModule } from './shared/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    IdentityModule,
  ],
})
export class AppModule {}
```

`backend/src/modules/identity/auth.service.ts` — trong `login`:
```ts
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: id }, { email: id }] },
      include: { role: true },
    });
```
và object `user` trả về thêm dòng sau `roleId: user.roleId,`:
```ts
        roleName: user.role.roleName,
```

`backend/src/modules/identity/password-reset.service.ts` — trong transaction:
```ts
      // Đặt lại mật khẩu thành công = chủ tài khoản đã chứng minh sở hữu email.
      await tx.user.update({
        where: { id: token.userId },
        data: { password, isVerified: true },
      });
```

- [ ] **Step 4: Chạy test**

Run: `npx -y pnpm@10 test`
Expected: PASS toàn bộ (23).

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(identity): return roleName on login, verify account on password reset, share JwtModule"
```

### Task A3: AuthGuard + `@Roles`

**Files:**
- Create: `backend/src/shared/auth/auth.guard.ts`, `backend/src/shared/auth/roles.decorator.ts`
- Modify: `backend/src/modules/identity/auth.service.ts` (import `JwtPayload` từ guard thay vì tự khai báo)
- Test: guard được test qua `users.spec.ts` ở Task A4 (guard không có route riêng để test độc lập).

**Interfaces:**
- Consumes: `AuthModule` (A2), `PrismaService`, `USER_STATUS`.
- Produces:
  - `interface JwtPayload { userId: number; roleId: number }`
  - `interface AuthUser { id: number; roleName: string }`
  - `type AuthedRequest = Request & { user: AuthUser }` (Request của `express`)
  - `class AuthGuard implements CanActivate` — dùng `@UseGuards(AuthGuard)`
  - `const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)`

- [ ] **Step 1: Tạo `roles.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Chỉ các role (RoleName) liệt kê được gọi handler/controller. Dùng kèm @UseGuards(AuthGuard). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 2: Tạo `auth.guard.ts`**

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { USER_STATUS } from '../../modules/identity/user-status';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';

export interface JwtPayload {
  userId: number;
  roleId: number;
}

export interface AuthUser {
  id: number;
  roleName: string;
}

export type AuthedRequest = Request & { user: AuthUser };

const SESSION_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';

/**
 * Verify JWT rồi đọc lại User + Role từ DB mỗi request: khoá / xoá / đổi role có hiệu lực ngay
 * mà vẫn không cần bảng session (JWT stateless đã chốt).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });
    if (!user || user.status !== USER_STATUS.ACTIVE) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const allowed = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed && !allowed.includes(user.role.roleName)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    req.user = { id: user.id, roleName: user.role.roleName };
    return true;
  }
}
```

- [ ] **Step 3: `auth.service.ts` dùng `JwtPayload` chung**

Xoá khối `export interface JwtPayload {...}` trong `auth.service.ts`, thêm:
```ts
import type { JwtPayload } from '../../shared/auth/auth.guard';
```

- [ ] **Step 4: Build + test**

Run: `npx -y pnpm@10 build && npx -y pnpm@10 test`
Expected: build OK; PASS (23).

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(auth): add JWT guard that re-checks user status and role per request"
```

### Task A4: Module `users` (TDD)

**Files:**
- Create: `backend/src/modules/users/users.spec.ts`, `users.dto.ts`, `users.service.ts`, `users.controller.ts`, `users.module.ts`
- Modify: `backend/src/app.module.ts`, `backend/src/app.setup.ts`, `backend/src/modules/identity/auth.dto.ts` (export `PASSWORD_MIN_LENGTH`)

**Interfaces:**
- Consumes: `AuthGuard`, `AuthedRequest`, `Roles` (A3); `ROLE` (A2); `USER_STATUS`; `hashPassword`; `ResponseMessage`; `createFakePrisma` (A1).
- Produces: routes đúng API Contract.

- [ ] **Step 1: Viết test fail `backend/src/modules/users/users.spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { User } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { setupApp } from '../../app.setup';
import { MailService } from '../../shared/mail/mail.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { hashPassword } from '../../shared/security/password';
import { createFakePrisma, type FakePrisma } from '../../test/fake-prisma';
import { USER_STATUS } from '../identity/user-status';

// Role id trong fake: 1 Quản trị viên, 2 Trưởng phòng, 3 Nhân viên. Phòng ban: 1 KYTHUAT, 2 KETOAN.

describe('Users: /users, /roles, /departments', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let secretHash: string;
  const http = () => request(app.getHttpServer());

  function addUser(username: string, roleId: number, status: string = USER_STATUS.ACTIVE): User {
    const now = new Date();
    const user: User = {
      id: prisma.users.length + 1,
      roleId,
      departmentId: 1,
      username,
      password: secretHash,
      fullName: `User ${username}`,
      email: `${username}@saigonbank.com.vn`,
      status,
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    prisma.users.push(user);
    return user;
  }
  const tokenOf = (user: User) =>
    `Bearer ${app.get(JwtService).sign({ userId: user.id, roleId: user.roleId })}`;

  let admin: User;
  let staff: User;
  let locked: User;
  let removed: User;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    secretHash = await hashPassword('Secret@123');
  });

  beforeEach(async () => {
    prisma = createFakePrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(MailService)
      .useValue({ sendOtpEmail: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    admin = addUser('admin', 1);
    staff = addUser('staff', 3);
    locked = addUser('locked', 3, USER_STATUS.INACTIVE);
    removed = addUser('removed', 3, USER_STATUS.DELETED);
  }, 30_000);

  afterEach(async () => {
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    await app.close();
  });

  describe('guard', () => {
    const expired = {
      success: false,
      data: null,
      error: 'UNAUTHORIZED',
      message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
    };

    it('không có token: 401', async () => {
      expect((await http().get('/users').expect(401)).body).toEqual(expired);
    });

    it('token rác: 401', async () => {
      await http().get('/users').set('Authorization', 'Bearer abc').expect(401);
    });

    it('token của user đã bị khoá: 401 (khoá có hiệu lực ngay)', async () => {
      await http().get('/roles').set('Authorization', tokenOf(locked)).expect(401);
    });

    it('token của user đã xoá: 401', async () => {
      await http().get('/roles').set('Authorization', tokenOf(removed)).expect(401);
    });

    it('Nhân viên gọi /users: 403', async () => {
      const res = await http().get('/users').set('Authorization', tokenOf(staff)).expect(403);
      expect(res.body).toEqual({
        success: false,
        data: null,
        error: 'FORBIDDEN',
        message: 'Bạn không có quyền thực hiện thao tác này',
      });
    });
  });

  describe('GET /roles, /departments', () => {
    it('user đã đăng nhập bất kỳ role nào đều đọc được', async () => {
      const roles = await http().get('/roles').set('Authorization', tokenOf(staff)).expect(200);
      expect(roles.body.data).toEqual([
        { id: 1, roleName: 'Quản trị viên' },
        { id: 2, roleName: 'Trưởng phòng' },
        { id: 3, roleName: 'Nhân viên' },
      ]);
      const deps = await http().get('/departments').set('Authorization', tokenOf(staff)).expect(200);
      expect(deps.body.data).toEqual([
        { id: 1, departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' },
        { id: 2, departmentCode: 'KETOAN', departmentName: 'Phòng Kế toán' },
      ]);
    });
  });

  describe('GET /users', () => {
    it('mặc định ẩn "Đã xóa", có role + department, không có password', async () => {
      const res = await http().get('/users').set('Authorization', tokenOf(admin)).expect(200);
      expect(res.body.data.map((u: { username: string }) => u.username)).toEqual([
        'admin',
        'staff',
        'locked',
      ]);
      expect(res.body.data[0]).toMatchObject({
        id: admin.id,
        role: { id: 1, roleName: 'Quản trị viên' },
        department: { id: 1, departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' },
        isVerified: true,
      });
      expect(res.body.data[0]).not.toHaveProperty('password');
      expect(res.body.data[0]).not.toHaveProperty('roleId');
    });

    it('lọc status "Đã xóa" thì thấy user đã xoá', async () => {
      const res = await http()
        .get('/users')
        .query({ status: USER_STATUS.DELETED })
        .set('Authorization', tokenOf(admin))
        .expect(200);
      expect(res.body.data.map((u: { username: string }) => u.username)).toEqual(['removed']);
    });

    it('search không phân biệt hoa thường, lọc theo roleId', async () => {
      const res = await http()
        .get('/users')
        .query({ search: 'STAF', roleId: 3 })
        .set('Authorization', tokenOf(admin))
        .expect(200);
      expect(res.body.data.map((u: { username: string }) => u.username)).toEqual(['staff']);
    });

    it('status không hợp lệ: 400', async () => {
      await http()
        .get('/users')
        .query({ status: 'abc' })
        .set('Authorization', tokenOf(admin))
        .expect(400);
    });
  });

  describe('POST /users', () => {
    const body = {
      username: '  tp.ketoan ',
      email: 'TP.KeToan@SaigonBank.com.vn',
      fullName: 'Trưởng phòng Kế toán',
      password: 'Init@123',
      roleId: 2,
      departmentId: 2,
    };

    it('201: tạo user chưa xác minh, hash mật khẩu, không trả password', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send(body)
        .expect(201);
      expect(res.body).toMatchObject({ success: true, message: 'Đã tạo người dùng' });
      expect(res.body.data).toMatchObject({
        username: 'tp.ketoan',
        email: 'tp.ketoan@saigonbank.com.vn',
        status: USER_STATUS.ACTIVE,
        isVerified: false,
        role: { id: 2, roleName: 'Trưởng phòng' },
        department: { id: 2, departmentCode: 'KETOAN', departmentName: 'Phòng Kế toán' },
      });
      expect(res.body.data).not.toHaveProperty('password');
      const saved = prisma.users.at(-1)!;
      expect(saved.password).not.toBe('Init@123');
      expect(saved.password).toMatch(/^\$2[aby]\$/);
    });

    it('không có departmentId: department null', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, departmentId: undefined })
        .expect(201);
      expect(res.body.data.department).toBeNull();
    });

    it('409 trùng username', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, username: 'staff' })
        .expect(409);
      expect(res.body.message).toBe('Tên đăng nhập đã tồn tại');
    });

    it('409 trùng email (kể cả khác hoa thường)', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, email: 'STAFF@saigonbank.com.vn' })
        .expect(409);
      expect(res.body.message).toBe('Email đã tồn tại');
    });

    it('400 role không tồn tại', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, roleId: 99 })
        .expect(400);
      expect(res.body.message).toBe('Vai trò không tồn tại');
    });

    it('400 phòng ban không tồn tại', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, departmentId: 99 })
        .expect(400);
      expect(res.body.message).toBe('Phòng ban không tồn tại');
    });

    it('400 validate: mật khẩu ngắn, email sai', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, password: '123', email: 'x' })
        .expect(400);
      expect(res.body.message).toContain('Mật khẩu phải có ít nhất 6 ký tự');
      expect(res.body.message).toContain('Email không hợp lệ');
    });
  });

  describe('PATCH /users/:id/status', () => {
    it('khoá rồi mở khoá', async () => {
      const lock = await http()
        .patch(`/users/${staff.id}/status`)
        .set('Authorization', tokenOf(admin))
        .send({ status: USER_STATUS.INACTIVE })
        .expect(200);
      expect(lock.body).toMatchObject({
        message: 'Đã cập nhật trạng thái',
        data: { id: staff.id, status: USER_STATUS.INACTIVE },
      });
      // Token cũ của user vừa bị khoá không dùng được nữa.
      await http().get('/roles').set('Authorization', tokenOf(staff)).expect(401);

      await http()
        .patch(`/users/${staff.id}/status`)
        .set('Authorization', tokenOf(admin))
        .send({ status: USER_STATUS.ACTIVE })
        .expect(200);
      expect(prisma.users[staff.id - 1].status).toBe(USER_STATUS.ACTIVE);
    });

    it('không cho đặt "Đã xóa" qua PATCH: 400', async () => {
      await http()
        .patch(`/users/${staff.id}/status`)
        .set('Authorization', tokenOf(admin))
        .send({ status: USER_STATUS.DELETED })
        .expect(400);
    });

    it('tự khoá mình: 400', async () => {
      const res = await http()
        .patch(`/users/${admin.id}/status`)
        .set('Authorization', tokenOf(admin))
        .send({ status: USER_STATUS.INACTIVE })
        .expect(400);
      expect(res.body.message).toBe('Không thể tự khoá tài khoản của mình');
    });

    it('user đã xoá / không tồn tại / id không phải số: 404', async () => {
      for (const id of [removed.id, 999, 'abc']) {
        const res = await http()
          .patch(`/users/${id}/status`)
          .set('Authorization', tokenOf(admin))
          .send({ status: USER_STATUS.INACTIVE })
          .expect(404);
        expect(res.body.message).toBe('Người dùng không tồn tại');
      }
    });
  });

  describe('DELETE /users/:id', () => {
    it('xoá mềm: row còn, status "Đã xóa", login sau đó 401', async () => {
      const res = await http()
        .delete(`/users/${staff.id}`)
        .set('Authorization', tokenOf(admin))
        .expect(200);
      expect(res.body).toEqual({
        success: true,
        data: null,
        error: null,
        message: 'Đã xoá người dùng',
      });
      expect(prisma.users[staff.id - 1].status).toBe(USER_STATUS.DELETED);
      await http()
        .post('/auth/login')
        .send({ identifier: 'staff', password: 'Secret@123' })
        .expect(401);
    });

    it('tự xoá mình: 400', async () => {
      const res = await http()
        .delete(`/users/${admin.id}`)
        .set('Authorization', tokenOf(admin))
        .expect(400);
      expect(res.body.message).toBe('Không thể tự xoá tài khoản của mình');
    });

    it('đã xoá rồi: 404', async () => {
      await http()
        .delete(`/users/${removed.id}`)
        .set('Authorization', tokenOf(admin))
        .expect(404);
    });
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx -y pnpm@10 test -- users.spec`
Expected: FAIL — các route trả 404 "Cannot GET /users".

- [ ] **Step 3: Export `PASSWORD_MIN_LENGTH`, bật `transform`**

`backend/src/modules/identity/auth.dto.ts`: đổi `const PASSWORD_MIN_LENGTH = 6;` thành `export const PASSWORD_MIN_LENGTH = 6;`.

`backend/src/app.setup.ts`: đổi dòng pipe thành
```ts
  // transform: query string → number cho các DTO có @Type(() => Number).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

- [ ] **Step 4: `users.dto.ts`**

```ts
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_MIN_LENGTH } from '../identity/auth.dto';
import { USER_STATUS } from '../identity/user-status';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const STATUS_MESSAGE = 'Trạng thái không hợp lệ';

export class ListUsersQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(Object.values(USER_STATUS), { message: STATUS_MESSAGE })
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Vai trò không hợp lệ' })
  roleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Phòng ban không hợp lệ' })
  departmentId?: number;
}

export class CreateUserDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập' })
  @MaxLength(100)
  username!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(150)
  email!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @MaxLength(150)
  fullName!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
  })
  password!: string;

  @IsInt({ message: 'Vui lòng chọn vai trò' })
  roleId!: number;

  @IsOptional()
  @IsInt({ message: 'Phòng ban không hợp lệ' })
  departmentId?: number;
}

export class UpdateUserStatusDto {
  @IsIn([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE], { message: STATUS_MESSAGE })
  status!: string;
}
```

- [ ] **Step 5: `users.service.ts`**

```ts
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
import { CreateUserDto, ListUsersQuery } from './users.dto';

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
                { username: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { fullName: { contains: q, mode: Prisma.QueryMode.insensitive } },
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
    if (await this.prisma.user.findUnique({ where: { username: dto.username } })) {
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
      !(await this.prisma.department.findUnique({ where: { id: dto.departmentId } }))
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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
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

  roles() {
    return this.prisma.role.findMany({ orderBy: { id: 'asc' } });
  }

  departments() {
    return this.prisma.department.findMany({ orderBy: { id: 'asc' } });
  }

  private async findLiveUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.status === USER_STATUS.DELETED) {
      throw new NotFoundException(USER_NOT_FOUND);
    }
    return user;
  }
}
```

- [ ] **Step 6: `users.controller.ts`**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../../shared/auth/auth.guard';
import { Roles } from '../../shared/auth/roles.decorator';
import { ResponseMessage } from '../../shared/http/api-response';
import { ROLE } from '../identity/roles';
import { CreateUserDto, ListUsersQuery, UpdateUserStatusDto } from './users.dto';
import { USER_NOT_FOUND, UsersService } from './users.service';

// id không phải số coi như user không tồn tại, thay cho message tiếng Anh mặc định của ParseIntPipe.
const UserId = () =>
  Param(
    'id',
    new ParseIntPipe({ exceptionFactory: () => new NotFoundException(USER_NOT_FOUND) }),
  );

@Controller('users')
@UseGuards(AuthGuard)
@Roles(ROLE.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Post()
  @ResponseMessage('Đã tạo người dùng')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id/status')
  @ResponseMessage('Đã cập nhật trạng thái')
  updateStatus(
    @Req() req: AuthedRequest,
    @UserId() id: number,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.updateStatus(req.user.id, id, dto.status);
  }

  @Delete(':id')
  @ResponseMessage('Đã xoá người dùng')
  remove(@Req() req: AuthedRequest, @UserId() id: number) {
    return this.users.softDelete(req.user.id, id);
  }
}

/** Danh mục cho dropdown — mọi user đã đăng nhập đều đọc được. */
@Controller()
@UseGuards(AuthGuard)
export class LookupController {
  constructor(private readonly users: UsersService) {}

  @Get('roles')
  roles() {
    return this.users.roles();
  }

  @Get('departments')
  departments() {
    return this.users.departments();
  }
}
```

- [ ] **Step 7: `users.module.ts` + đăng ký**

```ts
import { Module } from '@nestjs/common';
import { LookupController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, LookupController],
  providers: [UsersService],
})
export class UsersModule {}
```

`backend/src/app.module.ts`: thêm `import { UsersModule } from './modules/users/users.module';` và `UsersModule` vào cuối mảng `imports`.

- [ ] **Step 8: Chạy test**

Run: `npx -y pnpm@10 test`
Expected: PASS — auth 23 + users 24.
Nếu `GET /users` trả `roleId` hoặc `departmentId` ở top-level → sai `toListItem`, sửa lại cho khớp test.

- [ ] **Step 9: Build, lint, tsc**

Run: `npx -y pnpm@10 build && npx -y pnpm@10 lint && npx tsc --noEmit`
Expected: sạch (lint chạy `--fix`, commit luôn phần prettier tự sửa).

- [ ] **Step 10: Commit**

```bash
git add backend/src
git commit -m "feat(users): admin API to list, create, lock/unlock and soft-delete users"
```

### Task A5: Seed 3 role, 2 phòng ban

**Files:**
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Consumes: `ROLE` (A2), `USER_STATUS`.

- [ ] **Step 1: Thay `main()` trong `backend/prisma/seed.ts`**

Thêm import `import { ROLE } from '../src/modules/identity/roles';`, rồi thay thân `main()`:

```ts
async function main() {
  // findFirst-or-create: RoleName không unique trong schema nên không upsert được.
  const roleIds: Record<string, number> = {};
  for (const roleName of Object.values(ROLE)) {
    const role =
      (await prisma.role.findFirst({ where: { roleName } })) ??
      (await prisma.role.create({ data: { roleName } }));
    roleIds[roleName] = role.id;
  }

  const departments = [
    { departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' },
    { departmentCode: 'KETOAN', departmentName: 'Phòng Kế toán' },
  ];
  const departmentIds: Record<string, number> = {};
  for (const d of departments) {
    const dep = await prisma.department.upsert({
      where: { departmentCode: d.departmentCode },
      update: {},
      create: d,
    });
    departmentIds[d.departmentCode] = dep.id;
  }

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@saigonbank.com.vn',
      password: await hashPassword('Admin@123'),
      fullName: 'Quản trị viên hệ thống',
      roleId: roleIds[ROLE.ADMIN],
      departmentId: null, // Quản trị viên không thuộc phòng ban nghiệp vụ
      status: USER_STATUS.ACTIVE,
      isVerified: true,
    },
  });

  console.log(
    `Seed xong: ${Object.keys(roleIds).length} role, ${departments.length} phòng ban, user=${admin.username}`,
  );

  // User để test luồng quên mật khẩu: Resend (onboarding@resend.dev) chỉ gửi được tới email chủ tài khoản.
  // Email lấy từ .env để không commit email cá nhân vào repo.
  const devEmail = process.env.DEV_USER_EMAIL?.trim().toLowerCase();
  if (devEmail) {
    const dev = await prisma.user.upsert({
      where: { username: 'dev' },
      update: { email: devEmail },
      create: {
        username: 'dev',
        email: devEmail,
        password: await hashPassword('Dev@1234'),
        fullName: 'Người dùng thử nghiệm',
        roleId: roleIds[ROLE.STAFF],
        departmentId: departmentIds.KYTHUAT,
        status: USER_STATUS.ACTIVE,
        isVerified: false,
      },
    });
    console.log(`Seed user dev: ${dev.username} <${dev.email}>`);
  }
}
```

- [ ] **Step 2: Kiểm tra kiểu + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx -y pnpm@10 lint`
Expected: sạch. (**Không** chạy `prisma db seed` trong worktree — DB local do main thread xử lý ở I2.)

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "chore(db): seed Quản trị viên / Trưởng phòng / Nhân viên and Kỹ thuật / Kế toán departments"
```

---

# Track B — Frontend (`wt/fe-users`)

Chạy test FE: `npm test -w frontend` (gốc worktree) hoặc `npx vitest run <path>` trong `frontend/`.

## File map

| File | Trách nhiệm |
|---|---|
| Modify `frontend/src/shared/lib/apiClient.ts` | `apiRequest` + GET/POST/PATCH/DELETE, Authorization, hook 401 |
| Create `frontend/src/shared/lib/apiClient.test.ts` | Test apiClient |
| Create `frontend/src/test/fakeJwt.ts` | Tạo JWT giả có `exp` cho test |
| Modify `frontend/src/modules/auth/domain/session.ts` | `roleName`, `ADMIN_ROLE`, `isAdmin`, `isTokenExpired` |
| Create `frontend/src/modules/auth/domain/session.test.ts` | Test domain session |
| Modify `frontend/src/modules/auth/infrastructure/HttpAuthRepository.ts` (+ test) | Map `roleName` |
| Modify `frontend/src/app/session/SessionContext.tsx` | exp check, `notice`, `signOut(reason)`, cấu hình apiClient |
| Create `frontend/src/app/session/SessionContext.test.tsx` | Test hết hạn khi mở app + 401 |
| Modify `frontend/src/modules/auth/presentation/LoginPage.tsx` | Hiện `notice` |
| Create `frontend/src/app/session/RequireAdmin.tsx` | Guard route admin |
| Modify `frontend/src/shared/layout/navItems.ts`, `Sidebar.tsx`, `Sidebar.test.tsx` | Ẩn "Người dùng" với non-admin |
| Modify `frontend/src/app/router.tsx` | `/users`, `/users/new`, `/settings` |
| Modify `frontend/src/modules/user/presentation/UserSettingsPage.tsx` | Breadcrumb `/settings` |
| Create `frontend/src/modules/user/domain/userAccount.ts` (+ test) | Model + `validateNewUser` |
| Create `frontend/src/modules/user/application/UserAdminRepository.ts` | Port + service |
| Create `frontend/src/modules/user/infrastructure/HttpUserAdminRepository.ts` (+ test) | Adapter HTTP |
| Modify `frontend/src/modules/user/infrastructure/container.ts` | `userAdminService` |
| Create `frontend/src/modules/user/presentation/{useUserLookups.ts,UserListPage.tsx,CreateUserPage.tsx}` | Màn quản lý |

### Task B1: apiClient — Authorization, 401 hook, GET/PATCH/DELETE

**Files:**
- Modify: `frontend/src/shared/lib/apiClient.ts`
- Create: `frontend/src/shared/lib/apiClient.test.ts`

**Interfaces:**
- Produces:
  - `configureApiSession(s: { getToken: () => string | null; onUnauthorized: () => void }): void`
  - `apiRequest<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T>`
  - `apiGet<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>` — bỏ key rỗng/undefined
  - `apiPost<T>(path: string, body: unknown)`, `apiPatch<T>(path: string, body: unknown)`, `apiDelete<T>(path: string)`

- [ ] **Step 1: Viết test fail `apiClient.test.ts`**

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiGet, apiPost, configureApiSession } from './apiClient';

function stubFetch(status: number, envelope: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const ok = (data: unknown) => ({ success: true, data, error: null, message: 'Thành công' });
const expired = {
  success: false,
  data: null,
  error: 'UNAUTHORIZED',
  message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
};

const onUnauthorized = vi.fn();
let token: string | null = null;

beforeEach(() => {
  token = null;
  onUnauthorized.mockReset();
  configureApiSession({ getToken: () => token, onUnauthorized });
});
afterEach(() => vi.unstubAllGlobals());

it('có token: gửi header Authorization Bearer', async () => {
  token = 'jwt-abc';
  const fetchMock = stubFetch(200, ok([]));
  await apiGet('/users');
  expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer jwt-abc' });
});

it('không token: không gửi Authorization', async () => {
  const fetchMock = stubFetch(200, ok(null));
  await apiPost('/auth/login', { identifier: 'a', password: 'b' });
  expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
});

it('401 trên request có token: gọi onUnauthorized và vẫn ném message BE', async () => {
  token = 'jwt-old';
  stubFetch(401, expired);
  await expect(apiGet('/users')).rejects.toThrow(expired.message);
  expect(onUnauthorized).toHaveBeenCalledOnce();
});

it('401 khi chưa có token (sai mật khẩu): không gọi onUnauthorized', async () => {
  stubFetch(401, { ...expired, message: 'Sai tên đăng nhập hoặc mật khẩu' });
  await expect(apiPost('/auth/login', {})).rejects.toThrow('Sai tên đăng nhập hoặc mật khẩu');
  expect(onUnauthorized).not.toHaveBeenCalled();
});

it('apiGet dựng query, bỏ giá trị rỗng/undefined', async () => {
  const fetchMock = stubFetch(200, ok([]));
  await apiGet('/users', { search: 'an', status: '', roleId: 2, departmentId: undefined });
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/users?search=an&roleId=2');
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx vitest run src/shared/lib/apiClient.test.ts` (trong `frontend/`)
Expected: FAIL — `configureApiSession`/`apiGet` không tồn tại.

- [ ] **Step 3: Thay `frontend/src/shared/lib/apiClient.ts`**

```ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Mọi response BE đều bọc dạng này (backend/src/shared/http/api-response.ts). */
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface ApiSession {
  getToken: () => string | null;
  onUnauthorized: () => void;
}

let session: ApiSession = { getToken: () => null, onUnauthorized: () => {} };

/** SessionProvider đăng ký: lấy token hiện tại + tự đăng xuất khi BE trả 401. */
export function configureApiSession(next: ApiSession): void {
  session = next;
}

/** Gọi BE, trả `data` của envelope; lỗi thì ném Error mang `message` tiếng Việt từ BE. */
export async function apiRequest<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = session.getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ, vui lòng thử lại sau');
  }

  // Chỉ coi là hết phiên khi đã gửi token — 401 của /auth/login (sai mật khẩu) không có token.
  if (res.status === 401 && token) session.onUnauthorized();

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !envelope?.success) {
    throw new Error(envelope?.message ?? 'Đã có lỗi xảy ra');
  }
  return envelope.data;
}

export function apiGet<T>(path: string, query: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return apiRequest<T>('GET', qs ? `${path}?${qs}` : path);
}

export const apiPost = <T>(path: string, body: unknown) => apiRequest<T>('POST', path, body);
export const apiPatch = <T>(path: string, body: unknown) => apiRequest<T>('PATCH', path, body);
export const apiDelete = <T>(path: string) => apiRequest<T>('DELETE', path);
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run src/shared/lib/apiClient.test.ts src/modules/auth/infrastructure/HttpAuthRepository.test.ts`
Expected: PASS (5 + 4).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/apiClient.ts frontend/src/shared/lib/apiClient.test.ts
git commit -m "feat(frontend): send bearer token and hook 401 in apiClient"
```

### Task B2: Session — `roleName`, hết hạn token, tự đăng xuất

**Files:**
- Create: `frontend/src/test/fakeJwt.ts`, `frontend/src/modules/auth/domain/session.test.ts`, `frontend/src/app/session/SessionContext.test.tsx`
- Modify: `frontend/src/modules/auth/domain/session.ts`, `frontend/src/modules/auth/infrastructure/HttpAuthRepository.ts`, `HttpAuthRepository.test.ts`, `frontend/src/app/session/SessionContext.tsx`, `frontend/src/modules/auth/presentation/LoginPage.tsx`, `frontend/src/shared/layout/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `configureApiSession` (B1).
- Produces:
  - `AuthSession = { userId: string; displayName: string; email: string; token: string; roleName: string }`
  - `ADMIN_ROLE = 'Quản trị viên'`, `isAdmin(session: AuthSession | null): boolean`, `isTokenExpired(token: string, now?: number): boolean`
  - `useSession(): { session; notice: string | null; signIn(s); signOut(reason?: 'expired') }`
  - `SESSION_EXPIRED_NOTICE = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'` (export từ `SessionContext.tsx`)
  - `fakeJwt(expSeconds: number): string` (test helper)

- [ ] **Step 1: Helper `frontend/src/test/fakeJwt.ts`**

```ts
/** JWT giả (không ký) chỉ để test phần FE đọc `exp`. */
export function fakeJwt(exp: number): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ userId: 1, roleId: 1, exp })}.sig`;
}

export const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;
```

- [ ] **Step 2: Test fail `session.test.ts`**

```ts
import { expect, it } from 'vitest';
import { fakeJwt } from '@/test/fakeJwt';
import { isAdmin, isTokenExpired, type AuthSession } from './session';

const base: AuthSession = { userId: '1', displayName: 'A', email: 'a@b.vn', token: 't', roleName: 'Nhân viên' };

it('isTokenExpired: còn hạn / hết hạn / token hỏng', () => {
  const now = 1_000_000_000_000;
  expect(isTokenExpired(fakeJwt(now / 1000 + 60), now)).toBe(false);
  expect(isTokenExpired(fakeJwt(now / 1000 - 1), now)).toBe(true);
  expect(isTokenExpired('không-phải-jwt', now)).toBe(true);
});

it('isAdmin chỉ đúng với role Quản trị viên', () => {
  expect(isAdmin({ ...base, roleName: 'Quản trị viên' })).toBe(true);
  expect(isAdmin(base)).toBe(false);
  expect(isAdmin(null)).toBe(false);
});
```

Run: `npx vitest run src/modules/auth/domain/session.test.ts` → Expected: FAIL (hàm chưa có).

- [ ] **Step 3: Thay `frontend/src/modules/auth/domain/session.ts`**

```ts
/** An authenticated user session. Produced by the login use-case, consumed app-wide. */
export interface AuthSession {
  userId: string;
  displayName: string;
  email: string;
  token: string;
  /** Role.RoleName từ backend, vd. "Quản trị viên". */
  roleName: string;
}

export const ADMIN_ROLE = 'Quản trị viên';

export const isAdmin = (session: AuthSession | null): boolean => session?.roleName === ADMIN_ROLE;

/** Đọc `exp` (giây) trong payload JWT. Token hỏng / thiếu exp coi như hết hạn. */
export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof exp !== 'number' || exp * 1000 <= now;
  } catch {
    return true;
  }
}
```

Run lại → Expected: PASS.

- [ ] **Step 4: `HttpAuthRepository` map `roleName`**

Trong `HttpAuthRepository.ts`: interface `LoginResponse.user` thêm `roleName: string`; object trả về thêm `roleName: user.roleName,`.
Trong `HttpAuthRepository.test.ts` test đầu: data BE `user` thêm `roleName: 'Quản trị viên'`; expected session thêm `roleName: 'Quản trị viên'`.

- [ ] **Step 5: Test fail `SessionContext.test.tsx`**

```tsx
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiGet } from '@/shared/lib/apiClient';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { SessionProvider, useSession } from './SessionContext';

const KEY = 'idsm.session';
const stored = (token: string, roleName = 'Nhân viên') =>
  localStorage.setItem(KEY, JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token, roleName }));

function Probe() {
  const { session, notice } = useSession();
  return (
    <>
      <p>session:{session ? 'yes' : 'no'}</p>
      <p>notice:{notice ?? ''}</p>
    </>
  );
}
const renderProbe = () =>
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

it('token còn hạn: giữ phiên', () => {
  stored(fakeJwt(inOneHour()));
  renderProbe();
  expect(screen.getByText('session:yes')).toBeInTheDocument();
});

it('token hết hạn khi mở app: bỏ phiên, xoá storage, báo hết phiên', () => {
  stored(fakeJwt(Math.floor(Date.now() / 1000) - 10));
  renderProbe();
  expect(screen.getByText('session:no')).toBeInTheDocument();
  expect(screen.getByText('notice:Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')).toBeInTheDocument();
  expect(localStorage.getItem(KEY)).toBeNull();
});

it('phiên cũ thiếu roleName: bỏ phiên, không báo', () => {
  localStorage.setItem(KEY, JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: fakeJwt(inOneHour()) }));
  renderProbe();
  expect(screen.getByText('session:no')).toBeInTheDocument();
  expect(screen.getByText('notice:')).toBeInTheDocument();
});

it('API trả 401 khi đang đăng nhập: tự đăng xuất + báo hết phiên', async () => {
  stored(fakeJwt(inOneHour()));
  renderProbe();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, data: null, error: 'UNAUTHORIZED', message: 'x' }), { status: 401 }),
    ),
  );
  await act(async () => {
    await apiGet('/users').catch(() => undefined);
  });
  expect(screen.getByText('session:no')).toBeInTheDocument();
  expect(screen.getByText('notice:Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')).toBeInTheDocument();
  expect(localStorage.getItem(KEY)).toBeNull();
});
```

Run: `npx vitest run src/app/session/SessionContext.test.tsx` → Expected: FAIL (`notice` không tồn tại, session hết hạn vẫn giữ).

- [ ] **Step 6: Thay `frontend/src/app/session/SessionContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { isTokenExpired, type AuthSession } from '@/modules/auth/domain/session';
import { configureApiSession } from '@/shared/lib/apiClient';

const STORAGE_KEY = 'idsm.session';
export const SESSION_EXPIRED_NOTICE = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';

interface SessionContextValue {
  session: AuthSession | null;
  /** Thông báo cho màn đăng nhập (vd. hết phiên). Xoá khi đăng nhập lại. */
  notice: string | null;
  signIn: (session: AuthSession) => void;
  signOut: (reason?: 'expired') => void;
}

interface SessionState {
  session: AuthSession | null;
  notice: string | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function writeStored(session: AuthSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — session stays in memory only */
  }
}

function readInitial(): SessionState {
  let stored: AuthSession | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    stored = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    stored = null;
  }
  // Hàm thuần (StrictMode gọi initializer 2 lần) — việc xoá storage cũ làm trong useEffect.
  if (!stored) return { session: null, notice: null };
  // Phiên lưu từ bản cũ (chưa có roleName) — bỏ, bắt đăng nhập lại.
  if (!stored.roleName) return { session: null, notice: null };
  if (isTokenExpired(stored.token)) return { session: null, notice: SESSION_EXPIRED_NOTICE };
  return { session: stored, notice: null };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(readInitial);

  // Phiên lưu trong storage không hợp lệ / hết hạn lúc mở app → xoá hẳn.
  useEffect(() => {
    if (!state.session) writeStored(null);
  }, [state.session]);

  const signIn = useCallback((session: AuthSession) => {
    setState({ session, notice: null });
    writeStored(session);
  }, []);

  const signOut = useCallback((reason?: 'expired') => {
    setState({ session: null, notice: reason === 'expired' ? SESSION_EXPIRED_NOTICE : null });
    writeStored(null);
  }, []);

  // Cấu hình ngay trong render (không đợi useEffect): effect của page con chạy TRƯỚC effect của
  // provider, nên request đầu tiên của page phải thấy token ngay. Lệnh này idempotent.
  const token = state.session?.token ?? null;
  configureApiSession({ getToken: () => token, onUnauthorized: () => signOut('expired') });

  const value = useMemo<SessionContextValue>(
    () => ({ session: state.session, notice: state.notice, signIn, signOut }),
    [state, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
```

- [ ] **Step 7: `LoginPage` hiện `notice`**

Trong `LoginPage.tsx`: `const { signIn } = useSession();` → `const { signIn, notice } = useSession();`. Ngay trước `{error && <p ...>}` thêm:
```tsx
      {notice && !error && <p className="mt-3 text-sm text-status-warnFg">{notice}</p>}
```

- [ ] **Step 8: Sửa `Sidebar.test.tsx` cho session hợp lệ**

Session trong test cũ không có `roleName` + token `'jwt'` → giờ bị bỏ khi đọc. Đổi `localStorage.setItem(...)` thành:
```tsx
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: fakeJwt(inOneHour()), roleName: 'Nhân viên' }),
  );
```
và thêm `import { fakeJwt, inOneHour } from '@/test/fakeJwt';`.

- [ ] **Step 9: Chạy toàn bộ test + lint**

Run: `npm test -w frontend && npm run lint -w frontend` (gốc worktree)
Expected: PASS toàn bộ; tsc sạch.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): role-aware session, expire on JWT exp or 401 with login notice"
```

### Task B3: Domain + port + adapter quản lý user

**Files:**
- Create: `frontend/src/modules/user/domain/userAccount.ts`, `userAccount.test.ts`, `frontend/src/modules/user/application/UserAdminRepository.ts`, `frontend/src/modules/user/infrastructure/HttpUserAdminRepository.ts`, `HttpUserAdminRepository.test.ts`
- Modify: `frontend/src/modules/user/infrastructure/container.ts`

**Interfaces:**
- Consumes: `apiGet/apiPost/apiPatch/apiDelete` (B1); `Email`, `PASSWORD_MIN_LENGTH` từ `@/modules/auth/domain/credentials`.
- Produces:
  - `USER_STATUS`, `type UserStatus`, `interface Role`, `interface Department`, `interface UserAccount`
  - `interface NewUserDraft { username; fullName; email; password; confirmPassword; roleId: string; departmentId: string }`, `emptyNewUserDraft()`, `type NewUserErrors`, `validateNewUser(d): NewUserErrors`
  - `interface UserQuery { search: string; status: string; roleId: string; departmentId: string }` (`''` = tất cả)
  - `interface UserAdminRepository { list; create; setStatus; remove; roles; departments }`, `makeUserAdminService(repo)`, `UserAdminValidationError`
  - `userAdminService` export từ `container.ts`

- [ ] **Step 1: Test fail `userAccount.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { emptyNewUserDraft, validateNewUser } from './userAccount';

const valid = {
  ...emptyNewUserDraft(),
  username: 'tp.ketoan',
  fullName: 'Trưởng phòng Kế toán',
  email: 'tp@saigonbank.com.vn',
  password: 'Init@123',
  confirmPassword: 'Init@123',
  roleId: '2',
};

describe('validateNewUser', () => {
  it('form trống: báo đủ các trường bắt buộc', () => {
    expect(Object.keys(validateNewUser(emptyNewUserDraft())).sort()).toEqual(
      ['email', 'fullName', 'password', 'roleId', 'username'].sort(),
    );
  });

  it('form hợp lệ (phòng ban không bắt buộc)', () => {
    expect(validateNewUser(valid)).toEqual({});
  });

  it('email sai, mật khẩu ngắn, nhập lại không khớp', () => {
    expect(
      validateNewUser({ ...valid, email: 'tp(at)sgb', password: '123', confirmPassword: '124' }),
    ).toEqual({
      email: 'Email không hợp lệ',
      password: 'Mật khẩu phải có ít nhất 6 ký tự',
      confirmPassword: 'Mật khẩu xác nhận không khớp',
    });
  });
});
```

Run: `npx vitest run src/modules/user/domain/userAccount.test.ts` → FAIL (module chưa có).

- [ ] **Step 2: `userAccount.ts`**

```ts
import { Email, PASSWORD_MIN_LENGTH } from '@/modules/auth/domain/credentials';

/** Giá trị User.Status đã chốt ở backend (backend/src/modules/identity/user-status.ts). */
export const USER_STATUS = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  DELETED: 'Đã xóa',
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export interface Role {
  id: number;
  roleName: string;
}

export interface Department {
  id: number;
  departmentCode: string;
  departmentName: string;
}

/** 1 dòng trong danh sách quản lý — khớp `UserListItem` của GET /users. */
export interface UserAccount {
  id: number;
  username: string;
  fullName: string;
  email: string;
  status: UserStatus;
  isVerified: boolean;
  createdAt: string;
  role: Role;
  department: Department | null;
}

export interface NewUserDraft {
  username: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  /** id dạng chuỗi vì lấy thẳng từ <select>; '' = chưa chọn. */
  roleId: string;
  departmentId: string;
}

export const emptyNewUserDraft = (): NewUserDraft => ({
  username: '',
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  roleId: '',
  departmentId: '',
});

export type NewUserErrors = Partial<Record<keyof NewUserDraft, string>>;

const REQUIRED = 'Bắt buộc';

export function validateNewUser(d: NewUserDraft): NewUserErrors {
  const errors: NewUserErrors = {};
  if (!d.username.trim()) errors.username = REQUIRED;
  if (!d.fullName.trim()) errors.fullName = REQUIRED;
  if (!d.email.trim()) errors.email = REQUIRED;
  else if (!Email.isValid(d.email)) errors.email = 'Email không hợp lệ';
  if (d.password.length < PASSWORD_MIN_LENGTH)
    errors.password = `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`;
  if (d.confirmPassword !== d.password) errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
  if (!d.roleId) errors.roleId = REQUIRED;
  return errors;
}
```

Run lại → PASS. Lưu ý test "form trống": `confirmPassword === password === ''` nên không có lỗi confirm — đúng với danh sách expected.

- [ ] **Step 3: `application/UserAdminRepository.ts`**

```ts
import {
  validateNewUser,
  type Department,
  type NewUserDraft,
  type Role,
  type UserAccount,
  type UserStatus,
} from '../domain/userAccount';

/** Bộ lọc danh sách; '' = tất cả. */
export interface UserQuery {
  search: string;
  status: string;
  roleId: string;
  departmentId: string;
}

export interface UserAdminRepository {
  list(query: UserQuery): Promise<UserAccount[]>;
  create(draft: NewUserDraft): Promise<UserAccount>;
  setStatus(id: number, status: Exclude<UserStatus, 'Đã xóa'>): Promise<UserAccount>;
  /** Xoá mềm — backend chỉ đổi Status thành "Đã xóa". */
  remove(id: number): Promise<void>;
  roles(): Promise<Role[]>;
  departments(): Promise<Department[]>;
}

export class UserAdminValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'UserAdminValidationError';
  }
}

export function makeUserAdminService(repo: UserAdminRepository) {
  return {
    list: (query: UserQuery) => repo.list(query),
    create: (draft: NewUserDraft) => {
      const errors = validateNewUser(draft);
      if (Object.keys(errors).length) throw new UserAdminValidationError(errors as Record<string, string>);
      return repo.create(draft);
    },
    setStatus: (id: number, status: Exclude<UserStatus, 'Đã xóa'>) => repo.setStatus(id, status),
    remove: (id: number) => repo.remove(id),
    roles: () => repo.roles(),
    departments: () => repo.departments(),
  };
}

export type UserAdminService = ReturnType<typeof makeUserAdminService>;
```

- [ ] **Step 4: Test fail `HttpUserAdminRepository.test.ts`**

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { HttpUserAdminRepository } from './HttpUserAdminRepository';

const repo = new HttpUserAdminRepository();

function stubFetch(data: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: status < 400, data, error: null, message: 'OK' }), { status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
afterEach(() => vi.unstubAllGlobals());

it('list gửi bộ lọc khác rỗng lên query string', async () => {
  const fetchMock = stubFetch([]);
  await repo.list({ search: ' an ', status: '', roleId: '2', departmentId: '' });
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/users?search=an&roleId=2');
});

it('create chuẩn hoá body: trim, email thường, id số, bỏ phòng ban trống và confirmPassword', async () => {
  const fetchMock = stubFetch({ id: 9 }, 201);
  await repo.create({
    username: ' tp ',
    fullName: ' Trưởng phòng ',
    email: ' TP@SGB.vn ',
    password: 'Init@123',
    confirmPassword: 'Init@123',
    roleId: '2',
    departmentId: '',
  });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://localhost:3000/users');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({
    username: 'tp',
    fullName: 'Trưởng phòng',
    email: 'tp@sgb.vn',
    password: 'Init@123',
    roleId: 2,
  });
});

it('setStatus → PATCH /users/:id/status, remove → DELETE /users/:id', async () => {
  const fetchMock = stubFetch(null);
  await repo.setStatus(5, 'Ngừng hoạt động');
  await repo.remove(5);
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/users/5/status');
  expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: 'Ngừng hoạt động' });
  expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3000/users/5');
  expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
});
```

Run → FAIL (adapter chưa có).

- [ ] **Step 5: `HttpUserAdminRepository.ts`**

```ts
import { apiDelete, apiGet, apiPatch, apiPost } from '@/shared/lib/apiClient';
import type { UserAdminRepository, UserQuery } from '../application/UserAdminRepository';
import type { Department, NewUserDraft, Role, UserAccount, UserStatus } from '../domain/userAccount';

/** Adapter gọi module `users` của backend (backend/src/modules/users). */
export class HttpUserAdminRepository implements UserAdminRepository {
  list({ search, status, roleId, departmentId }: UserQuery) {
    return apiGet<UserAccount[]>('/users', { search: search.trim(), status, roleId, departmentId });
  }

  create(d: NewUserDraft) {
    return apiPost<UserAccount>('/users', {
      username: d.username.trim(),
      fullName: d.fullName.trim(),
      email: d.email.trim().toLowerCase(),
      password: d.password,
      roleId: Number(d.roleId),
      departmentId: d.departmentId ? Number(d.departmentId) : undefined, // undefined bị JSON bỏ qua
    });
  }

  setStatus(id: number, status: Exclude<UserStatus, 'Đã xóa'>) {
    return apiPatch<UserAccount>(`/users/${id}/status`, { status });
  }

  async remove(id: number) {
    await apiDelete<null>(`/users/${id}`);
  }

  roles() {
    return apiGet<Role[]>('/roles');
  }

  departments() {
    return apiGet<Department[]>('/departments');
  }
}
```

`container.ts` thay toàn bộ:
```ts
import { makeUserAdminService } from '../application/UserAdminRepository';
import { makeUserSettingsService } from '../application/UserSettingsRepository';
import { HttpUserAdminRepository } from './HttpUserAdminRepository';
import { InMemoryUserSettingsRepository } from './InMemoryUserSettingsRepository';

export const userSettingsService = makeUserSettingsService(new InMemoryUserSettingsRepository());
export const userAdminService = makeUserAdminService(new HttpUserAdminRepository());
```

- [ ] **Step 6: Chạy test + lint**

Run: `npm test -w frontend && npm run lint -w frontend`
Expected: PASS; tsc sạch.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/user
git commit -m "feat(user): domain, port and HTTP adapter for admin user management"
```

### Task B4: Màn danh sách người dùng (`/users`)

**Files:**
- Create: `frontend/src/modules/user/presentation/useUserLookups.ts`
- Create: `frontend/src/modules/user/presentation/UserListPage.tsx` (route gắn ở B6)

**Interfaces:**
- Consumes: `userAdminService`, `USER_STATUS`, `UserAccount`, `UserQuery` (B3); `useSession` (B2); UI kit `PageHeader`, `Card`, `Button`, `Badge`, `DataTable`, `SearchInput`, `Select`; `useAsyncData`, `useAsyncAction`.
- Produces: `useUserLookups(): { roles: Role[]; departments: Department[] }`.

Đọc skill `frontend-design:frontend-design` trước khi code, nhưng **bám token và component có sẵn** (`DeviceCatalogPage.tsx` là mẫu bố cục) — không thêm màu/token mới.

- [ ] **Step 1: `useUserLookups.ts`**

```ts
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { userAdminService } from '../infrastructure/container';

/** Danh mục role + phòng ban cho dropdown lọc và form tạo. */
export function useUserLookups() {
  const { data } = useAsyncData(
    () => Promise.all([userAdminService.roles(), userAdminService.departments()]),
    [],
  );
  return { roles: data?.[0] ?? [], departments: data?.[1] ?? [] };
}
```

- [ ] **Step 2: `UserListPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { useSession } from '@/app/session/SessionContext';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { SearchInput } from '@/shared/ui/SearchInput';
import { Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { UserQuery } from '../application/UserAdminRepository';
import { USER_STATUS, type UserAccount, type UserStatus } from '../domain/userAccount';
import { userAdminService } from '../infrastructure/container';
import { useUserLookups } from './useUserLookups';

const STATUS_TONE: Record<UserStatus, BadgeTone> = {
  'Đang hoạt động': 'ok',
  'Ngừng hoạt động': 'warn',
  'Đã xóa': 'neutral',
};

type RowAction = 'lock' | 'unlock' | 'delete';
const CONFIRM: Record<RowAction, string> = {
  lock: 'Khoá tài khoản',
  unlock: 'Mở khoá tài khoản',
  delete: 'Xoá tài khoản',
};

const ICON_BTN = 'rounded p-1 hover:bg-surface-sunken disabled:opacity-40';

export function UserListPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { roles, departments } = useUserLookups();
  const [query, setQuery] = useState<UserQuery>({ search: '', status: '', roleId: '', departmentId: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const { data: users, loading, error } = useAsyncData(
    () => userAdminService.list(query),
    [query.search, query.status, query.roleId, query.departmentId, reloadKey],
  );

  const act = useAsyncAction(async (user: UserAccount, action: RowAction) => {
    // ponytail: confirm native của trình duyệt — đổi sang Modal khi shared/ui có.
    if (!window.confirm(`${CONFIRM[action]} "${user.username}"?`)) return;
    if (action === 'delete') await userAdminService.remove(user.id);
    else
      await userAdminService.setStatus(
        user.id,
        action === 'lock' ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE,
      );
    setReloadKey((k) => k + 1);
  });

  const set = (patch: Partial<UserQuery>) => setQuery((q) => ({ ...q, ...patch }));

  const columns: Array<Column<UserAccount>> = [
    { key: 'username', header: 'Tên đăng nhập', cell: (u) => <span className="font-medium">{u.username}</span> },
    { key: 'fullName', header: 'Họ và tên', cell: (u) => u.fullName },
    { key: 'email', header: 'Email', cell: (u) => <span className="text-ink-muted">{u.email}</span> },
    { key: 'role', header: 'Vai trò', cell: (u) => u.role.roleName },
    { key: 'department', header: 'Phòng ban', cell: (u) => u.department?.departmentName ?? '—' },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
          {!u.isVerified && u.status !== USER_STATUS.DELETED && <Badge tone="info">Chưa xác minh</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Hoạt động',
      align: 'right',
      cell: (u) => {
        // Không thao tác trên chính mình (BE cũng chặn) và trên tài khoản đã xoá.
        if (String(u.id) === session?.userId || u.status === USER_STATUS.DELETED) return null;
        const locked = u.status === USER_STATUS.INACTIVE;
        return (
          <div className="flex justify-end gap-1 text-ink-muted">
            <button
              type="button"
              className={ICON_BTN}
              disabled={act.pending}
              aria-label={locked ? CONFIRM.unlock : CONFIRM.lock}
              title={locked ? CONFIRM.unlock : CONFIRM.lock}
              onClick={() => void act.run(u, locked ? 'unlock' : 'lock')}
            >
              {locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className={`${ICON_BTN} hover:text-status-dangerFg`}
              disabled={act.pending}
              aria-label={CONFIRM.delete}
              title={CONFIRM.delete}
              onClick={() => void act.run(u, 'delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Trang chủ', to: '/dashboard' }, { label: 'Người dùng' }]}
        title="Quản lý người dùng"
        actions={
          <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/users/new')}>
            Thêm người dùng
          </Button>
        }
      />

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row">
          <SearchInput
            placeholder="Tìm theo tên đăng nhập, họ tên hoặc email"
            value={query.search}
            onChange={(e) => set({ search: e.target.value })}
          />
          <Select className="lg:w-48" value={query.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">Trạng thái (Tất cả)</option>
            {Object.values(USER_STATUS).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select className="lg:w-44" value={query.roleId} onChange={(e) => set({ roleId: e.target.value })}>
            <option value="">Vai trò (Tất cả)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roleName}
              </option>
            ))}
          </Select>
          <Select
            className="lg:w-48"
            value={query.departmentId}
            onChange={(e) => set({ departmentId: e.target.value })}
          >
            <option value="">Phòng ban (Tất cả)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.departmentName}
              </option>
            ))}
          </Select>
        </div>

        {(act.error ?? error) && <p className="mb-3 text-sm text-status-dangerFg">{act.error ?? error}</p>}

        <DataTable
          columns={columns}
          rows={users ?? []}
          rowKey={(u) => String(u.id)}
          empty={loading ? 'Đang tải…' : 'Không tìm thấy người dùng nào'}
        />
      </Card>
    </>
  );
}
```

- [ ] **Step 3: Lint + test**

Run: `npm run lint -w frontend && npm test -w frontend`
Expected: sạch / PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/user/presentation
git commit -m "feat(user): admin user list with filters, lock/unlock and soft delete"
```

### Task B5: Màn tạo người dùng (`/users/new`)

**Files:**
- Create: `frontend/src/modules/user/presentation/CreateUserPage.tsx` (route gắn ở B6)

**Interfaces:**
- Consumes: `emptyNewUserDraft`, `validateNewUser`, `NewUserDraft`, `NewUserErrors` (B3); `UserAdminValidationError`; `userAdminService`; `useUserLookups` (B4); UI kit.

- [ ] **Step 1: `CreateUserPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { Input, Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { UserAdminValidationError } from '../application/UserAdminRepository';
import {
  emptyNewUserDraft,
  validateNewUser,
  type NewUserDraft,
  type NewUserErrors,
} from '../domain/userAccount';
import { userAdminService } from '../infrastructure/container';
import { useUserLookups } from './useUserLookups';

const INVALID = 'Vui lòng kiểm tra các trường bắt buộc';

export function CreateUserPage() {
  const navigate = useNavigate();
  const { roles, departments } = useUserLookups();
  const [draft, setDraft] = useState<NewUserDraft>(emptyNewUserDraft);
  const [errors, setErrors] = useState<NewUserErrors>({});
  const patch = (p: Partial<NewUserDraft>) => setDraft((d) => ({ ...d, ...p }));

  const submit = useAsyncAction(async () => {
    const next = validateNewUser(draft);
    setErrors(next);
    if (Object.keys(next).length) throw new Error(INVALID);
    try {
      await userAdminService.create(draft);
      navigate('/users');
    } catch (e) {
      if (e instanceof UserAdminValidationError) throw new Error(INVALID);
      throw e; // lỗi BE (vd. 409 trùng) hiện nguyên message tiếng Việt
    }
  });

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Người dùng', to: '/users' },
          { label: 'Thêm người dùng' },
        ]}
        title="Thêm người dùng"
      />

      <Card>
        <form
          className="divide-y divide-line"
          onSubmit={(e) => {
            e.preventDefault();
            void submit.run();
          }}
        >
          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Thông tin tài khoản</h3>
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              <Field label="Tên đăng nhập" htmlFor="username" required error={errors.username}>
                <Input
                  id="username"
                  autoComplete="off"
                  value={draft.username}
                  onChange={(e) => patch({ username: e.target.value })}
                />
              </Field>
              <Field label="Họ và tên" htmlFor="fullName" required error={errors.fullName}>
                <Input id="fullName" value={draft.fullName} onChange={(e) => patch({ fullName: e.target.value })} />
              </Field>
              <Field label="Email" htmlFor="email" required error={errors.email}>
                <Input
                  id="email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => patch({ email: e.target.value })}
                />
              </Field>
              <Field label="Vai trò" htmlFor="roleId" required error={errors.roleId}>
                <Select
                  id="roleId"
                  placeholder="Chọn vai trò"
                  value={draft.roleId}
                  onChange={(e) => patch({ roleId: e.target.value })}
                  options={roles.map((r) => ({ value: String(r.id), label: r.roleName }))}
                />
              </Field>
              <Field
                label="Phòng ban"
                htmlFor="departmentId"
                hint="Trưởng phòng Kế toán / Kỹ thuật được phân biệt theo phòng ban"
              >
                <Select
                  id="departmentId"
                  value={draft.departmentId}
                  onChange={(e) => patch({ departmentId: e.target.value })}
                >
                  <option value="">Không thuộc phòng ban</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.departmentName}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Mật khẩu ban đầu</h3>
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              <Field
                label="Mật khẩu"
                htmlFor="password"
                required
                error={errors.password}
                hint="Tài khoản ở trạng thái “Chưa xác minh” cho tới khi nhân viên tự đặt lại mật khẩu qua “Quên mật khẩu”"
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={draft.password}
                  onChange={(e) => patch({ password: e.target.value })}
                />
              </Field>
              <Field label="Nhập lại mật khẩu" htmlFor="confirmPassword" required error={errors.confirmPassword}>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={draft.confirmPassword}
                  onChange={(e) => patch({ confirmPassword: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 p-6">
            {submit.error && <span className="mr-auto text-sm text-status-dangerFg">{submit.error}</span>}
            <Button type="button" variant="outline" onClick={() => navigate('/users')}>
              Hủy
            </Button>
            <Button type="submit" variant="dark" disabled={submit.pending}>
              {submit.pending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Lint + test + build**

Run: `npm run lint -w frontend && npm test -w frontend && npm run build -w frontend`
Expected: sạch / PASS / build OK.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/user/presentation/CreateUserPage.tsx
git commit -m "feat(user): create-user form with admin-set initial password"
```
### Task B6: Phân quyền + route (`/users` admin, `/settings` cá nhân)

**Files:**
- Create: `frontend/src/app/session/RequireAdmin.tsx`
- Modify: `frontend/src/shared/layout/navItems.ts`, `Sidebar.tsx`, `Sidebar.test.tsx`, `frontend/src/app/router.tsx`, `frontend/src/modules/user/presentation/UserSettingsPage.tsx`
**Interfaces:**
- Consumes: `isAdmin`, `useSession` (B2); `UserListPage` (B4), `CreateUserPage` (B5).
- Produces: `RequireAdmin` (route element), `NavItem.adminOnly?: boolean`.

- [ ] **Step 1: Test fail — thêm vào `Sidebar.test.tsx`**

```tsx
const renderSidebarAs = (roleName: string) => {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: fakeJwt(inOneHour()), roleName }),
  );
  render(
    <SessionProvider>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </SessionProvider>,
  );
};

it('Quản trị viên thấy mục "Người dùng"', () => {
  renderSidebarAs('Quản trị viên');
  expect(screen.getByRole('link', { name: 'Người dùng' })).toBeInTheDocument();
});

it('Nhân viên không thấy mục "Người dùng" nhưng vẫn thấy "Cài đặt"', () => {
  renderSidebarAs('Nhân viên');
  expect(screen.queryByRole('link', { name: 'Người dùng' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Cài đặt' })).toBeInTheDocument();
});
```
Thêm `import { afterEach } from 'vitest'` và `afterEach(() => localStorage.clear());` nếu chưa có (Testing Library tự cleanup DOM).

Run: `npx vitest run src/shared/layout/Sidebar.test.tsx` → FAIL ở test Nhân viên.

- [ ] **Step 2: `navItems.ts`**

Interface thêm field và đánh dấu mục Người dùng:
```ts
export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Chỉ hiện với Quản trị viên. */
  adminOnly?: boolean;
}
```
```ts
  { label: 'Người dùng', to: '/users', icon: Users, adminOnly: true },
```

- [ ] **Step 3: `Sidebar.tsx`**

Thêm `import { isAdmin } from '@/modules/auth/domain/session';`, đổi `const { signOut } = useSession();` thành `const { session, signOut } = useSession();`, và:
```tsx
        {PRIMARY_NAV.filter((item) => !item.adminOnly || isAdmin(session)).map((item) => (
          <Item key={item.to} item={item} />
        ))}
```

- [ ] **Step 4: `RequireAdmin.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { isAdmin } from '@/modules/auth/domain/session';
import { useSession } from './SessionContext';

/** Chỉ Quản trị viên vào được; role khác về /dashboard. Đặt bên trong <RequireAuth/>. */
export function RequireAdmin() {
  const { session } = useSession();
  return isAdmin(session) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
```

- [ ] **Step 5: `router.tsx`**

Thêm imports:
```tsx
import { RequireAdmin } from './session/RequireAdmin';
import { UserListPage } from '@/modules/user/presentation/UserListPage';
import { CreateUserPage } from '@/modules/user/presentation/CreateUserPage';
```
Trong children của `AppShell`, thay hai dòng `/users` và `/settings`:
```tsx
          {
            element: <RequireAdmin />,
            children: [
              { path: '/users', element: <UserListPage /> },
              { path: '/users/new', element: <CreateUserPage /> },
            ],
          },
          { path: '/settings', element: <UserSettingsPage /> },
```
(xoá `{ path: '/users', element: <UserSettingsPage /> }` và `{ path: '/settings', element: <ComingSoonPage title="Cài đặt" /> }`).

- [ ] **Step 6: Breadcrumb `UserSettingsPage.tsx`**

```tsx
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Cài đặt' },
        ]}
```

- [ ] **Step 7: Chạy test + lint**

Run: `npm test -w frontend && npm run lint -w frontend`
Expected: PASS; tsc sạch.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): admin-only Người dùng nav and routes, personal settings at /settings"
```


---

# Track C — Docs (`wt/docs-changes`)

### Task C1: `docs/Changes.md`

**Files:**
- Create: `docs/Changes.md`

**Interfaces:**
- Consumes: API Contract ở đầu plan; `backend/prisma/schema.prisma` (đọc, không sửa).

- [ ] **Step 1: Viết `docs/Changes.md`** (tiếng Việt, chép thẳng vào báo cáo được). Nội dung bắt buộc, đúng thứ tự:

````markdown
# Thay đổi cần cập nhật vào báo cáo BCTT-HKTT

> Tổng hợp những điểm code thật (backend `identity` + `users`, schema Prisma) đã khác hoặc bổ sung
> so với bản báo cáo hiện tại. Cập nhật lần cuối: 2026-09-19.

## 1. UC-01 — Đăng nhập
- Đăng nhập bằng **tên đăng nhập hoặc email** + mật khẩu.
- Luật mới (có trong SD/AD, chưa có trong text UC): tài khoản **"Ngừng hoạt động"** nhập đúng mật khẩu
  → **403 "Tài khoản đã bị khoá"**. Mật khẩu được kiểm **trước** khi báo khoá, để người không biết mật
  khẩu không dò được tài khoản nào đang bị khoá (sai mật khẩu vẫn trả 401 như thường).
- Tài khoản **"Đã xóa"** xử lý y hệt tài khoản không tồn tại: **401 "Sai tên đăng nhập hoặc mật khẩu"**.
- Kết quả trả về có `roleName` để giao diện hiện/ẩn chức năng theo vai trò.
- Mọi API cần đăng nhập kiểm lại tài khoản trong DB ở **mỗi request**: tài khoản bị khoá / xoá thì phiên
  đang mở hết hiệu lực ngay (401 "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại"), giao diện tự đăng xuất.

## 2. UC-02 — Quên mật khẩu
- Chỉ tài khoản **"Đang hoạt động"** nhận được mã; email không tồn tại, bị khoá hoặc đã xoá đều trả
  **404 "Email không tồn tại"** (luật mới, bổ sung vào UC-02).
- OTP **4 chữ số**, hiệu lực **5 phút**, lưu dạng **hash SHA-256**; chỉ mã **mới nhất** có hiệu lực;
  sai quá **5 lần** thì mã bị vô hiệu.
- Bước đặt lại mật khẩu luôn xác thực lại OTP ở backend.
- Đặt lại mật khẩu thành công → **`IsVerified = true`** (tài khoản được xác minh).

## 3. UC-04 / UC-05 / UC-06 — Quản lý người dùng (chỉ Quản trị viên)
| Chức năng | Luật |
|---|---|
| Xem danh sách | Tìm theo tên đăng nhập / họ tên / email; lọc theo trạng thái, vai trò, phòng ban. Mặc định ẩn tài khoản "Đã xóa". |
| Tạo tài khoản | Quản trị viên nhập tên đăng nhập, họ tên, email, vai trò, phòng ban (không bắt buộc), mật khẩu ban đầu (≥ 6 ký tự). Tài khoản mới **"Đang hoạt động"**, **`IsVerified = false`**. Trùng tên đăng nhập / email → 409. |
| Khoá / mở khoá | Đổi Status giữa "Đang hoạt động" và "Ngừng hoạt động". Có hiệu lực ngay với phiên đang mở. |
| Xoá | **Xoá mềm**: Status = "Đã xóa", không xoá bản ghi. Tên đăng nhập/email của tài khoản đã xoá vẫn bị giữ (không tạo lại được). |
| Ràng buộc | Quản trị viên không tự khoá / tự xoá tài khoản của mình. Chưa có chức năng sửa thông tin tài khoản. |

## 4. Vai trò và phòng ban
| Vai trò | Quyền (hiện tại / dự kiến) |
|---|---|
| Quản trị viên | Chỉ quản lý người dùng |
| Trưởng phòng | Trưởng phòng **Kế toán**: tạo lệnh Kiểm kê (dự kiến). Trưởng phòng **Kỹ thuật**: duyệt lệnh điều chuyển (dự kiến). Phân biệt bằng phòng ban của tài khoản. |
| Nhân viên | Người dùng thường |

Phòng ban: **KYTHUAT — Phòng Kỹ thuật**, **KETOAN — Phòng Kế toán**.

## 5. ERD 3.2.1 — cần vẽ lại
- Thêm bảng **PasswordResetToken** (chưa có trên ERD gốc).
- Bảng **User** thêm cột **IsVerified**, **CreatedAt**, **UpdatedAt**.
- DBML (dán vào dbdiagram.io để xuất ảnh):

```dbml
Table Role {
  Id int [pk, increment]
  RoleName varchar(100) [not null]
}

Table Department {
  Id int [pk, increment]
  DepartmentCode varchar(50) [not null, unique]
  DepartmentName varchar(150) [not null]
}

Table User {
  Id int [pk, increment]
  RoleId int [not null, ref: > Role.Id]
  DepartmentId int [ref: > Department.Id]
  Username varchar(100) [not null, unique]
  Password varchar(255) [not null, note: 'bcrypt hash']
  FullName varchar(150) [not null]
  Email varchar(150) [not null, unique]
  Status varchar(50) [not null, default: 'Đang hoạt động', note: 'Đang hoạt động | Ngừng hoạt động | Đã xóa']
  IsVerified boolean [not null, default: false]
  CreatedAt timestamp [not null, default: `now()`]
  UpdatedAt timestamp [not null]
}

Table PasswordResetToken {
  Id int [pk, increment]
  UserId int [not null, ref: > User.Id]
  TokenHash varchar(255) [not null, note: 'SHA-256 của OTP']
  ExpiresAt timestamp [not null]
  UsedAt timestamp
  CreatedAt timestamp [not null, default: `now()`]

  indexes {
    TokenHash
  }
}
```

## 6. Còn treo
- `Department.DepartmentCode` đang để **unique** theo giả định (icon khoá trên ERD) — chưa xác nhận.
````

- [ ] **Step 2: Đối chiếu DBML với schema**

Run: `grep -nE "@map\(\"|@db\.|@unique|@default" backend/prisma/schema.prisma`
Expected: mọi cột / độ dài varchar / unique / default trong DBML khớp output. Sai chỗ nào sửa DBML (không sửa schema).

- [ ] **Step 3: Commit**

```bash
git add docs/Changes.md
git commit -m "docs: list report (BCTT-HKTT) updates for auth and user management"
```

---

# Integration (main thread, sau khi A, B, C xong)

### Task I1: Ghép nhánh + cập nhật tài liệu repo

**Files:**
- Modify: `docs/CONTEXT.md`, `backend/README.md`, `frontend/README.md`, `README.md`
- Add: `docs/superpowers/specs/2026-09-19-user-management-design.md`, `docs/superpowers/plans/2026-09-19-user-management.md`

- [ ] **Step 1: Tạo nhánh và merge**

```bash
git switch -c feat/user-management main
git add docs/superpowers
git commit -m "docs: add user management design spec and implementation plan"
git merge --no-ff wt/be-users -m "merge: backend user management"
git merge --no-ff wt/fe-users -m "merge: frontend user management"
git merge --no-ff wt/docs-changes -m "merge: report change list"
```
Expected: không conflict (3 track không chạm cùng file). Conflict → dừng, báo người dùng.

- [ ] **Step 2: Cập nhật tài liệu**
  - `docs/CONTEXT.md`: §1 stack/"Cách gọi API" (apiRequest + Authorization + 401 → `signOut('expired')`; `/users` gọi BE thật); §2 bảng `shared/lib` (`apiGet/apiPost/apiPatch/apiDelete`, `configureApiSession`), thêm `RequireAdmin`; §3 route `/users` (admin, BE thật), `/users/new`, `/settings` (màn cá nhân, mock); §4 bỏ "Chưa có trang quản lý người dùng", bỏ dòng "Token hết hạn" ở 4.4, thêm placeholder mới: confirm native thay Modal, không phân trang, không sửa thông tin user, user đã xoá giữ username/email; §5 điểm 1 → đã giải quyết; §6 thêm hết hạn/401 tự đăng xuất; tài khoản dev.
  - `backend/README.md`: bảng API thêm `/users*`, `/roles`, `/departments`, ghi chú guard; bỏ câu "Chưa có endpoint nào yêu cầu JWT"; seed mới (3 role, 2 phòng ban).
  - `frontend/README.md` + `README.md`: `/users` là quản lý (admin), `/settings` cá nhân; module `user` có phần gọi BE thật.

- [ ] **Step 3: Commit**

```bash
git add docs README.md backend/README.md frontend/README.md
git commit -m "docs: update context and READMEs for user management"
```

### Task I2: Verification tổng + DB local + code review

- [ ] **Step 1: Test/build/lint cả hai phía**

```bash
cd backend && npx -y pnpm@10 install && npx prisma generate && npx -y pnpm@10 test && npx -y pnpm@10 build && npx -y pnpm@10 lint && npx tsc --noEmit
cd .. && npm install && npm test -w frontend && npm run build -w frontend && npm run lint -w frontend
```
Expected: tất cả sạch. Ghi lại số test thật (BE ~47, FE ~34) để báo cáo.

- [ ] **Step 2: DB local — HỎI người dùng trước**

Seed không xoá phòng `IT` cũ và không đổi role/phòng ban của `admin`/`dev` đã tồn tại. Đề xuất `npx prisma migrate reset` trong `backend/` (xoá dữ liệu dev, seed lại; `dev` về mật khẩu `Dev@1234`). Chỉ chạy khi người dùng đồng ý.

- [ ] **Step 3: E2E tay** (BE `pnpm start:dev` :3000 + FE `npm run dev` :5173, PG18 thật) — 7 kịch bản ở mục 8 của spec. Sau khi xong, tắt tiến trình Nest còn giữ :3000 (`Get-NetTCPConnection -LocalPort 3000 -State Listen`).

- [ ] **Step 4: Code review** bằng `superpowers:requesting-code-review` trên diff `main...feat/user-management`; xử lý finding bằng `superpowers:receiving-code-review`.

### Task I3: Dọn dẹp + bàn giao

- [ ] **Step 1:** Cập nhật memory (`project_overview.md` state/open items, `user_management_decisions.md`).
- [ ] **Step 2:** Xoá worktree + nhánh `wt/*` (skill `superpowers:finishing-a-development-branch`) — **hỏi trước**.
- [ ] **Step 3:** Báo người dùng: nhánh `feat/user-management` sẵn sàng; **không merge `main`, không push** cho tới khi được bảo.
