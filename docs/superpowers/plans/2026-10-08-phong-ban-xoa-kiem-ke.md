# Phòng ban & chức vụ, lọc thành viên, xoá/thùng rác kiểm kê, đổi nhãn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm phòng Kinh doanh/Nghiệp vụ với quy tắc chức vụ theo phòng, đổi `Cộng tác viên` → `Chuyên viên`, lọc thành viên kiểm kê theo phòng ban, cho TP Kế toán xoá/dọn thùng rác đợt kiểm kê và xoá bảng tổng hợp, đổi nhãn `Chờ thanh lý` → `Chờ xử lý` và `Đơn vị kiểm kê` → `Đơn vị được kiểm kê`.

**Architecture:** Backend NestJS + Prisma (PostgreSQL), test bằng Jest + supertest trên `createFakePrisma()` (không DB thật). Frontend React + Vite + Tailwind, DDD 4 lớp/module, test Vitest + Testing Library với `fetch` stub. Quy tắc phòng ban × chức vụ là hằng số code ở cả BE (chốt chặn thật) lẫn FE (lọc dropdown + validate). Không thêm bảng/cột; 2 migration SQL chỉ `UPDATE` dữ liệu.

**Tech Stack:** NestJS 11, Prisma 7, Jest, React 18, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-08-phong-ban-chuc-vu-xoa-kiem-ke-design.md`

**Lệnh chạy test:**
- Backend: `cd backend && npx jest <đường dẫn>` (backend **không** nằm trong npm workspace gốc).
- Frontend: `npm test -- <đường dẫn>` từ gốc repo (alias `-w frontend`), lint: `npm run lint`.

## Global Constraints

- Không thêm bảng, không thêm cột. `AuditSummary` **không** có thùng rác — xoá cứng.
- Nhãn viết hoa chữ đầu câu: `Chuyên viên`, `Chờ xử lý`, `Đã xóa`, `Đơn vị được kiểm kê`.
- Giá trị trạng thái/role lưu **nguyên văn tiếng Việt** trong DB — đổi chuỗi phải có migration `UPDATE`.
- Mã phòng ban: `KYTHUAT`, `KETOAN`, `KINHDOANH` ("Phòng Kinh doanh"), `NGHIEPVU` ("Phòng Nghiệp vụ").
- Chỉ **TP Kế toán** xoá đợt, dọn thùng rác, xoá bảng tổng hợp. Chuyên viên Kế toán **xem** được đợt `Đã xóa`.
- Xoá mềm đợt được ở `Chưa kiểm kê`, `Đang kiểm kê`, `Đã duyệt`, `Đã hủy`; **không** ở `Chờ duyệt`.
- `presentation` lấy service từ `container.ts`; `domain`/`application` không import React.
- Mọi nút có handler thật; xác nhận bằng `window.confirm` (giống màn thiết bị).
- Commit message kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Xoá đợt đang mở (`Đang kiểm kê`) → thiết bị của nó lập được vào đợt mới ngay (Task 5, test "nhả thiết bị").
2. Gọi thao tác ghi (start / members / items / submit) lên đợt `Đã xóa` → 400, không đổi dữ liệu (Task 5).
3. Form tạo user: đã chọn `Chuyên viên` ở Kỹ thuật rồi đổi sang Kinh doanh → ô Chức vụ tự xoá trắng (Task 3).
4. `POST /audits/purge` với id chưa xoá mềm → bỏ qua lặng lẽ, không bị xoá cứng (Task 5).
5. Thành viên đã ngừng hoạt động trong đợt → vẫn bỏ chọn được qua chip trong picker (Task 4).

---

### Task 1: Đổi role `Cộng tác viên` → `Chuyên viên` (BE + FE, migration)

**Files:**
- Create: `backend/prisma/migrations/20261008090000_rename_collab_role/migration.sql`
- Modify: `backend/src/modules/identity/roles.ts`, `backend/src/shared/auth/actors.ts`, `backend/src/shared/auth/actors.spec.ts`,
  mọi controller dùng `ACTOR.TECH_COLLAB` / `ACTOR.ACCT_COLLAB` (`audits`, `audit-summaries`, `devices`, `device-orders`, `device-transfers`),
  `backend/src/modules/users/users.service.ts` (chỉ import, logic ở Task 2), `backend/src/test/fake-prisma.ts:174-179`,
  `backend/prisma/seed.ts`, `backend/scripts/e2e-*.ps1`, mọi `*.spec.ts` có chuỗi `Cộng tác viên`.
- Modify FE: `frontend/src/modules/auth/domain/session.ts`, `frontend/src/modules/user/domain/userAccount.ts`,
  `frontend/src/modules/user/presentation/CreateUserPage.tsx` (hint), `frontend/src/modules/audit/presentation/AuditMembersTab.tsx` (comment),
  `frontend/src/shared/layout/navItems.ts` (comment), mọi `*.test.ts(x)` có `Cộng tác viên`.

**Interfaces:**
- Produces (BE): `ROLE.SPECIALIST = 'Chuyên viên'`; `ACTOR.TECH_SPECIALIST`, `ACTOR.ACCT_SPECIALIST` (thay `TECH_COLLAB`, `ACCT_COLLAB`).
- Produces (FE): `SPECIALIST_ROLE = 'Chuyên viên'`; `isTechSpecialist`, `isAcctSpecialist` (thay `isTechCollab`, `isAcctCollab`). Các `can*` giữ nguyên tên.

- [ ] **Step 1: Đổi chuỗi trong test trước (để test đỏ)**

```bash
cd "F:/Internship/Saigonbank Device Hub"
grep -rlE "Cộng tác viên" backend/src frontend/src --include=*.spec.ts --include=*.test.ts --include=*.test.tsx \
  | xargs sed -i 's/Cộng tác viên/Chuyên viên/g'
sed -i "s/{ id: 4, roleName: 'Cộng tác viên' }/{ id: 4, roleName: 'Chuyên viên' }/" backend/src/test/fake-prisma.ts
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `cd backend && npx jest src/shared/auth src/modules/audits` và `npm test -- src/modules/auth`
Expected: FAIL — session/actor so `roleName` với `'Cộng tác viên'` cũ nên CTV bị 403 / `isTechCollab` false.

- [ ] **Step 3: Đổi hằng số và tên actor**

`backend/src/modules/identity/roles.ts`:

```ts
// Tên role đã chốt (cột Role.RoleName). "Trưởng phòng" và "Chuyên viên" phân biệt
// phòng ban bằng User.DepartmentId.
export const ROLE = {
  ADMIN: 'Quản trị viên',
  HEAD: 'Trưởng phòng',
  STAFF: 'Nhân viên',
  SPECIALIST: 'Chuyên viên',
} as const;

/** Role vô nghĩa nếu thiếu phòng ban — bắt buộc chọn phòng ban khi tạo user. (Task 2 thay bằng ROLES_BY_DEPARTMENT.) */
export const DEPARTMENT_REQUIRED_ROLES: readonly string[] = [
  ROLE.HEAD,
  ROLE.SPECIALIST,
];
```

`backend/src/shared/auth/actors.ts` — thay 2 actor:

```ts
  TECH_SPECIALIST: (u) =>
    u.roleName === ROLE.SPECIALIST && u.departmentCode === TECH_DEPARTMENT_CODE,
  ACCT_SPECIALIST: (u) =>
    u.roleName === ROLE.SPECIALIST && u.departmentCode === ACCT_DEPARTMENT_CODE,
```

Rồi đổi mọi chỗ dùng:

```bash
grep -rl "TECH_COLLAB\|ACCT_COLLAB\|ROLE.COLLAB" backend/src backend/prisma \
  | xargs sed -i 's/TECH_COLLAB/TECH_SPECIALIST/g; s/ACCT_COLLAB/ACCT_SPECIALIST/g; s/ROLE\.COLLAB/ROLE.SPECIALIST/g'
grep -rl "CTV\|Cộng tác viên" backend/src --include=*.ts | xargs sed -i 's/Cộng tác viên/Chuyên viên/g; s/\bCTV\b/Chuyên viên/g'
```

`frontend/src/modules/auth/domain/session.ts`: `COLLAB_ROLE` → `SPECIALIST_ROLE = 'Chuyên viên'`, `isTechCollab` → `isTechSpecialist`,
`isAcctCollab` → `isAcctSpecialist`, comment "Cộng tác viên" → "Chuyên viên":

```bash
grep -rl "COLLAB_ROLE\|isTechCollab\|isAcctCollab\|Cộng tác viên\|isCollab" frontend/src \
  | xargs sed -i 's/COLLAB_ROLE/SPECIALIST_ROLE/g; s/isTechCollab/isTechSpecialist/g; s/isAcctCollab/isAcctSpecialist/g; s/Cộng tác viên/Chuyên viên/g'
```

(`isCollab` là biến local trong `AuditDetailPage.tsx` — đổi thành `isSpecialist` bằng tay cho dễ đọc.)

- [ ] **Step 4: Migration + seed + script**

`backend/prisma/migrations/20261008090000_rename_collab_role/migration.sql`:

```sql
-- Đổi tên role, giữ nguyên Id nên User.RoleId không đổi.
UPDATE "Role" SET "RoleName" = 'Chuyên viên' WHERE "RoleName" = 'Cộng tác viên';
```

`backend/prisma/seed.ts`: `fullName: 'Cộng tác viên Kỹ thuật (dev)'` → `'Chuyên viên Kỹ thuật (dev)'`, tương tự Kế toán; username `ctv.kt`, `ctv.ketoan` giữ nguyên.
`backend/scripts/e2e-*.ps1`: `sed -i "s/Cộng tác viên/Chuyên viên/g" backend/scripts/e2e-*.ps1`.

- [ ] **Step 5: Chạy toàn bộ test BE + FE, lint**

Run: `cd backend && npx jest` rồi `npm test` và `npm run lint` (gốc repo)
Expected: PASS hết. `grep -rn "Cộng tác viên\|COLLAB" backend/src frontend/src backend/prisma/seed.ts` → không còn kết quả.

- [ ] **Step 6: Commit**

```bash
git add -A backend frontend
git commit -m "refactor: đổi role Cộng tác viên thành Chuyên viên (migration đổi tên, giữ Id)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — phòng Kinh doanh/Nghiệp vụ và quy tắc chức vụ theo phòng

**Files:**
- Modify: `backend/src/modules/identity/roles.ts`, `backend/src/modules/users/users.service.ts:71-95`,
  `backend/prisma/seed.ts:28-31`, `backend/src/test/fake-prisma.ts:180-183`
- Test: `backend/src/modules/users/users.spec.ts` (describe `POST /users`)

**Interfaces:**
- Consumes: `ROLE.SPECIALIST` (Task 1).
- Produces: `ROLES_BY_DEPARTMENT: Record<string, readonly string[]>`, `roleAllowedFor(roleName: string, departmentCode: string | null): boolean`.
  Thông báo lỗi: thiếu phòng ban → `'Vui lòng chọn phòng ban'`; Admin có phòng ban → `'Quản trị viên không thuộc phòng ban'`;
  chức vụ không có ở phòng → `` `Phòng ${departmentName} không có chức vụ ${roleName}` ``.

- [ ] **Step 1: Thêm phòng ban vào fake + viết test đỏ**

`backend/src/test/fake-prisma.ts` — mảng `departments`:

```ts
  const departments: Department[] = [
    { id: 1, departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' },
    { id: 2, departmentCode: 'KETOAN', departmentName: 'Phòng Kế toán' },
    { id: 3, departmentCode: 'KINHDOANH', departmentName: 'Phòng Kinh doanh' },
    { id: 4, departmentCode: 'NGHIEPVU', departmentName: 'Phòng Nghiệp vụ' },
  ];
```

`backend/src/modules/users/users.spec.ts`, trong `describe('POST /users')` — **thay** test `'không có departmentId: department null'` và bảng `it.each` cũ bằng:

```ts
    it('201 Quản trị viên không có phòng ban', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, roleId: 1, departmentId: undefined })
        .expect(201);
      expect(res.body.data.department).toBeNull();
    });

    it.each([
      ['Trưởng phòng thiếu phòng ban', 2, undefined],
      ['Nhân viên thiếu phòng ban', 3, undefined],
      ['Chuyên viên thiếu phòng ban', 4, undefined],
      ['Chuyên viên gửi departmentId: null', 4, null],
    ])('400 %s', async (_label, roleId, departmentId) => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, roleId, departmentId })
        .expect(400);
      expect(res.body.message).toBe('Vui lòng chọn phòng ban');
      expect(prisma.users.some((u) => u.username === 'tp.ketoan')).toBe(false);
    });

    it('400 Quản trị viên có phòng ban', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, roleId: 1, departmentId: 2 })
        .expect(400);
      expect(res.body.message).toBe('Quản trị viên không thuộc phòng ban');
    });

    it.each([
      [3, 'Phòng Kinh doanh'],
      [4, 'Phòng Nghiệp vụ'],
    ])('400 Chuyên viên ở phòng %i', async (departmentId, name) => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, roleId: 4, departmentId })
        .expect(400);
      expect(res.body.message).toBe(`Phòng ${name.replace('Phòng ', '')} không có chức vụ Chuyên viên`);
    });

    it.each([
      [2, 3],
      [3, 3],
      [2, 4],
      [3, 4],
      [3, 1],
      [3, 2],
    ])('201 roleId %i ở phòng %i', async (roleId, departmentId) => {
      await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, roleId, departmentId })
        .expect(201);
    });
```

Lưu ý thông báo: dùng `departmentName` bỏ tiền tố "Phòng " để ra "Phòng Kinh doanh không có chức vụ Chuyên viên" (không lặp "Phòng Phòng").

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `cd backend && npx jest src/modules/users -t "POST /users"`
Expected: FAIL — Nhân viên thiếu phòng ban đang 201; Admin có phòng ban đang 201; Chuyên viên ở KD đang 201.

- [ ] **Step 3: Quy tắc trong `roles.ts`**

Thay `DEPARTMENT_REQUIRED_ROLES` bằng:

```ts
/** Chức vụ hợp lệ theo DepartmentCode. Không phòng ban → chỉ Quản trị viên. */
export const ROLES_BY_DEPARTMENT: Record<string, readonly string[]> = {
  KYTHUAT: [ROLE.HEAD, ROLE.SPECIALIST, ROLE.STAFF],
  KETOAN: [ROLE.HEAD, ROLE.SPECIALIST, ROLE.STAFF],
  KINHDOANH: [ROLE.HEAD, ROLE.STAFF],
  NGHIEPVU: [ROLE.HEAD, ROLE.STAFF],
};

export function roleAllowedFor(
  roleName: string,
  departmentCode: string | null,
): boolean {
  if (departmentCode === null) return roleName === ROLE.ADMIN;
  return (ROLES_BY_DEPARTMENT[departmentCode] ?? []).includes(roleName);
}
```

- [ ] **Step 4: Áp dụng trong `UsersService.create`**

Thay khối `if (dto.departmentId == null) { ... } else if (...)` (users.service.ts:84-95) bằng:

```ts
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
```

Import: `import { ROLE, roleAllowedFor } from '../identity/roles';` (bỏ `DEPARTMENT_REQUIRED_ROLES`).

- [ ] **Step 5: Seed 2 phòng ban mới**

`backend/prisma/seed.ts` — mảng phòng ban:

```ts
    { departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' },
    { departmentCode: 'KETOAN', departmentName: 'Phòng Kế toán' },
    { departmentCode: 'KINHDOANH', departmentName: 'Phòng Kinh doanh' },
    { departmentCode: 'NGHIEPVU', departmentName: 'Phòng Nghiệp vụ' },
```

- [ ] **Step 6: Chạy toàn bộ test BE**

Run: `cd backend && npx jest`
Expected: PASS. Nếu test khác tạo `Nhân viên` không phòng ban qua `POST /users`, sửa body cho có `departmentId`.
(Test dựng user thẳng bằng `addUser(...)` trong fake không đi qua validate → không ảnh hưởng.)

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(user-be): phòng Kinh doanh/Nghiệp vụ, chức vụ hợp lệ theo phòng ban, Nhân viên bắt buộc phòng ban

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — form tạo user chọn phòng ban trước

**Files:**
- Modify: `frontend/src/modules/user/domain/userAccount.ts`, `frontend/src/modules/user/application/UserAdminRepository.ts:44-49`,
  `frontend/src/modules/user/infrastructure/HttpUserAdminRepository.ts:18`, `frontend/src/modules/user/presentation/CreateUserPage.tsx`
- Test: `frontend/src/modules/user/domain/userAccount.test.ts`, `frontend/src/modules/user/infrastructure/HttpUserAdminRepository.test.ts`

**Interfaces:**
- Consumes: `SPECIALIST_ROLE`, `HEAD_ROLE`, `ADMIN_ROLE` từ `auth/domain/session.ts` (Task 1).
- Produces:
  - `NO_DEPARTMENT = 'NONE'` — giá trị `draft.departmentId` khi chọn "— Không (Quản trị viên) —". `''` = chưa chọn.
  - `allowedRoleNames(departmentCode: string | null): readonly string[]`
  - `validateNewUser(d: NewUserDraft, roleName?: string, departmentCode?: string | null): NewUserErrors`
    (`departmentCode` undefined = danh mục chưa tải → không kiểm tổ hợp; `null` = không phòng ban).

- [ ] **Step 1: Test đỏ cho domain**

Thay nội dung `frontend/src/modules/user/domain/userAccount.test.ts` từ `describe('validateNewUser'` trở xuống:

```ts
describe('allowedRoleNames', () => {
  it.each([
    ['KYTHUAT', ['Trưởng phòng', 'Chuyên viên', 'Nhân viên']],
    ['KETOAN', ['Trưởng phòng', 'Chuyên viên', 'Nhân viên']],
    ['KINHDOANH', ['Trưởng phòng', 'Nhân viên']],
    ['NGHIEPVU', ['Trưởng phòng', 'Nhân viên']],
  ])('%s', (code, roles) => {
    expect(allowedRoleNames(code)).toEqual(roles);
  });
  it('không phòng ban: chỉ Quản trị viên', () => {
    expect(allowedRoleNames(null)).toEqual(['Quản trị viên']);
  });
});

describe('validateNewUser', () => {
  it('form trống: báo đủ các trường bắt buộc (cả phòng ban)', () => {
    expect(Object.keys(validateNewUser(emptyNewUserDraft())).sort()).toEqual(
      ['departmentId', 'email', 'fullName', 'password', 'roleId', 'username'].sort(),
    );
  });

  it('Trưởng phòng Kế toán hợp lệ', () => {
    expect(validateNewUser({ ...valid, departmentId: '2' }, 'Trưởng phòng', 'KETOAN')).toEqual({});
  });

  it('Quản trị viên không phòng ban hợp lệ', () => {
    expect(validateNewUser({ ...valid, departmentId: NO_DEPARTMENT }, 'Quản trị viên', null)).toEqual({});
  });

  it('Chuyên viên ở Kinh doanh: lỗi chức vụ', () => {
    expect(validateNewUser({ ...valid, departmentId: '3' }, 'Chuyên viên', 'KINHDOANH')).toEqual({
      roleId: 'Chức vụ không thuộc phòng ban đã chọn',
    });
  });

  it('chưa chọn phòng ban: lỗi phòng ban', () => {
    expect(validateNewUser(valid, 'Nhân viên')).toEqual({ departmentId: 'Vui lòng chọn phòng ban' });
  });

  it('danh mục chưa tải (không biết role/mã phòng): không chặn tổ hợp, backend sẽ kiểm', () => {
    expect(validateNewUser({ ...valid, departmentId: '2' })).toEqual({});
  });

  it('email sai, mật khẩu ngắn, nhập lại không khớp', () => {
    expect(
      validateNewUser({ ...valid, departmentId: '2', email: 'tp(at)sgb', password: '123', confirmPassword: '124' }),
    ).toEqual({
      email: 'Email không hợp lệ',
      password: 'Mật khẩu phải có ít nhất 8 ký tự',
      confirmPassword: 'Mật khẩu xác nhận không khớp',
    });
  });
});
```

Import đầu file: `import { NO_DEPARTMENT, allowedRoleNames, emptyNewUserDraft, validateNewUser } from './userAccount';`
(Giữ nguyên thông điệp email/mật khẩu như test cũ đang assert — đọc test cũ để chép đúng chuỗi `PASSWORD_MIN_LENGTH` nếu khác 8.)

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `npm test -- src/modules/user/domain`
Expected: FAIL — `allowedRoleNames`, `NO_DEPARTMENT` chưa tồn tại.

- [ ] **Step 3: Implement domain**

`frontend/src/modules/user/domain/userAccount.ts` — import `ADMIN_ROLE, HEAD_ROLE, SPECIALIST_ROLE` từ session, thêm hằng `STAFF_ROLE = 'Nhân viên'` cục bộ; xoá `DEPARTMENT_REQUIRED_ROLES`; thêm:

```ts
/** Giá trị ô Phòng ban khi chọn "— Không (Quản trị viên) —". '' = chưa chọn. */
export const NO_DEPARTMENT = 'NONE';

const STAFF_ROLE = 'Nhân viên';

/** Khớp ROLES_BY_DEPARTMENT ở backend (backend/src/modules/identity/roles.ts). */
const ROLES_BY_DEPARTMENT: Record<string, readonly string[]> = {
  KYTHUAT: [HEAD_ROLE, SPECIALIST_ROLE, STAFF_ROLE],
  KETOAN: [HEAD_ROLE, SPECIALIST_ROLE, STAFF_ROLE],
  KINHDOANH: [HEAD_ROLE, STAFF_ROLE],
  NGHIEPVU: [HEAD_ROLE, STAFF_ROLE],
};

export function allowedRoleNames(departmentCode: string | null): readonly string[] {
  return departmentCode === null ? [ADMIN_ROLE] : (ROLES_BY_DEPARTMENT[departmentCode] ?? []);
}

/** `roleName` / `departmentCode`: tra từ danh mục theo draft; undefined = danh mục chưa tải, không kiểm tổ hợp. */
export function validateNewUser(
  d: NewUserDraft,
  roleName?: string,
  departmentCode?: string | null,
): NewUserErrors {
  const errors: NewUserErrors = {};
  if (!d.username.trim()) errors.username = REQUIRED;
  if (!d.fullName.trim()) errors.fullName = REQUIRED;
  if (!d.email.trim()) errors.email = REQUIRED;
  else if (!Email.isValid(d.email)) errors.email = 'Email không hợp lệ';
  if (d.password.length < PASSWORD_MIN_LENGTH)
    errors.password = `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`;
  if (d.confirmPassword !== d.password) errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
  if (!d.departmentId) errors.departmentId = 'Vui lòng chọn phòng ban';
  if (!d.roleId) errors.roleId = REQUIRED;
  else if (roleName && departmentCode !== undefined && !allowedRoleNames(departmentCode).includes(roleName))
    errors.roleId = 'Chức vụ không thuộc phòng ban đã chọn';
  return errors;
}
```

- [ ] **Step 4: Body gửi BE**

`HttpUserAdminRepository.ts:18`:

```ts
      departmentId:
        d.departmentId && d.departmentId !== NO_DEPARTMENT ? Number(d.departmentId) : undefined, // undefined bị JSON bỏ qua
```

Thêm vào `HttpUserAdminRepository.test.ts` một test: create với `departmentId: 'NONE'` → body không có `departmentId`
(chép cấu trúc test create sẵn có trong file, chỉ đổi `departmentId` và assert `expect(JSON.parse(body)).not.toHaveProperty('departmentId')`).

- [ ] **Step 5: `CreateUserPage.tsx`**

- Đưa `<Field label="Phòng ban" ... required>` lên **trước** ô Vai trò; đổi label ô Vai trò thành **"Chức vụ"**; bỏ `hint`.
- Ô Phòng ban:

```tsx
<Select
  id="departmentId"
  value={draft.departmentId}
  onChange={(e) => {
    const departmentId = e.target.value;
    const code = codeOf(departmentId);
    const roleName = roleNameOf(draft.roleId);
    // Đổi phòng làm chức vụ đang chọn không còn hợp lệ → xoá trắng chức vụ.
    const keepRole = roleName && code !== undefined && allowedRoleNames(code).includes(roleName);
    patch({ departmentId, roleId: keepRole ? draft.roleId : '' });
  }}
>
  <option value="">Chọn phòng ban</option>
  {departments.map((d) => (
    <option key={d.id} value={d.id}>
      {d.departmentName}
    </option>
  ))}
  <option value={NO_DEPARTMENT}>— Không (Quản trị viên) —</option>
</Select>
```

- Helpers trong component:

```ts
const codeOf = (departmentId: string): string | null | undefined =>
  departmentId === NO_DEPARTMENT
    ? null
    : departments.find((d) => String(d.id) === departmentId)?.departmentCode;
const roleNameOf = (roleId: string) => roles.find((r) => String(r.id) === roleId)?.roleName;
const deptCode = codeOf(draft.departmentId);
const roleOptions =
  draft.departmentId && deptCode !== undefined
    ? roles.filter((r) => allowedRoleNames(deptCode).includes(r.roleName))
    : [];
```

- Ô Chức vụ: `disabled={!draft.departmentId}`, `placeholder="Chọn chức vụ"`, `options={roleOptions.map(...)}`.
- `submit`: `validateNewUser(draft, roleNameOf(draft.roleId), draft.departmentId ? codeOf(draft.departmentId) : undefined)`.

- [ ] **Step 6: Test trang (Review Focus #3)**

Tạo `frontend/src/modules/user/presentation/CreateUserPage.test.tsx` theo mẫu `UserListPage.test.tsx` (stub `fetch`, `SessionProvider`, `MemoryRouter`).
Stub `/roles` → `[{id:1,'Quản trị viên'},{id:2,'Trưởng phòng'},{id:3,'Nhân viên'},{id:4,'Chuyên viên'}]`,
`/departments` → 4 phòng như fake BE. Test:

```tsx
it('Chức vụ khoá tới khi chọn phòng; KD không có Chuyên viên; đổi phòng xoá chức vụ không hợp lệ', async () => {
  renderPage();
  const role = await screen.findByLabelText(/Chức vụ/);
  expect(role).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Phòng ban/), { target: { value: '1' } });
  await waitFor(() => expect(role).not.toBeDisabled());
  expect(within(role).getByRole('option', { name: 'Chuyên viên' })).toBeInTheDocument();
  fireEvent.change(role, { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText(/Phòng ban/), { target: { value: '3' } });
  expect(within(role).queryByRole('option', { name: 'Chuyên viên' })).toBeNull();
  expect((role as HTMLSelectElement).value).toBe('');
});

it('Không phòng ban → chỉ có Quản trị viên', async () => {
  renderPage();
  fireEvent.change(await screen.findByLabelText(/Phòng ban/), { target: { value: 'NONE' } });
  const role = screen.getByLabelText(/Chức vụ/);
  expect(within(role).getAllByRole('option').map((o) => o.textContent)).toEqual(['Chọn chức vụ', 'Quản trị viên']);
});
```

(Kiểm cách `Select` render `placeholder` — nếu placeholder không phải `<option>` thì bỏ phần tử đầu trong `toEqual`.)

- [ ] **Step 7: Chạy test + lint**

Run: `npm test -- src/modules/user` và `npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat(user-fe): chọn phòng ban trước, chức vụ lọc theo phòng, Nhân viên bắt buộc phòng ban

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Thành viên tham gia lọc theo phòng ban

**Files:**
- Modify: `backend/src/modules/users/users.service.ts:257-265` (`userLookup` select), test trong `backend/src/modules/users/users.spec.ts`
- Modify: `frontend/src/modules/audit/domain/audit.ts`, `frontend/src/modules/audit/application/AuditRepository.ts`,
  `frontend/src/modules/audit/infrastructure/HttpAuditRepository.ts`, `frontend/src/modules/audit/presentation/ScheduleAuditModal.tsx`,
  `frontend/src/modules/audit/presentation/AuditMembersTab.tsx`
- Create: `frontend/src/modules/audit/presentation/AuditMemberPicker.tsx`, `frontend/src/modules/audit/presentation/AuditMemberPicker.test.tsx`
- Test: `frontend/src/modules/audit/domain/audit.test.ts`

**Interfaces:**
- Produces (BE): `GET /users/lookup` item = `{ id, fullName, username, departmentId: number | null }`.
- Produces (FE domain):
  ```ts
  export interface MemberOption { id: number; fullName: string; username: string; departmentId: number | null }
  export function membersOfDepartment(users: MemberOption[], departmentId: number): MemberOption[]
  ```
  `auditService.users(): Promise<MemberOption[]>`.
- Produces (FE component):
  ```ts
  AuditMemberPicker(props: {
    users: MemberOption[];              // user đang hoạt động
    departments: DepartmentRef[];
    selected: number[];
    onChange: (ids: number[]) => void;
    stale?: UserRef[];                  // thành viên cũ không còn hoạt động
  })
  ```

- [ ] **Step 1: BE test đỏ**

Trong `users.spec.ts`, tìm test của `GET /users/lookup` và thêm:

```ts
    it('trả departmentId để FE lọc theo phòng ban', async () => {
      const res = await http()
        .get('/users/lookup?active=true')
        .set('Authorization', tokenOf(admin))
        .expect(200);
      expect(res.body.data[0]).toEqual(
        expect.objectContaining({ id: expect.any(Number), departmentId: null }),
      );
    });
```

(`admin` không có phòng ban → `departmentId: null`.) Run `cd backend && npx jest src/modules/users -t lookup` → FAIL.

- [ ] **Step 2: BE implement**

`users.service.ts` `userLookup`: `select: { id: true, fullName: true, username: true, departmentId: true },`
Run lại → PASS. Commit riêng không cần — gộp với FE ở Step 8.

- [ ] **Step 3: FE domain test đỏ**

`audit.test.ts` thêm:

```ts
describe('membersOfDepartment', () => {
  const u = (id: number, departmentId: number | null) => ({ id, fullName: `U${id}`, username: `u${id}`, departmentId });
  it('chỉ giữ user thuộc phòng đã chọn, bỏ user không phòng ban', () => {
    expect(membersOfDepartment([u(1, 1), u(2, 2), u(3, null), u(4, 1)], 1).map((x) => x.id)).toEqual([1, 4]);
  });
});
```

Run `npm test -- src/modules/audit/domain` → FAIL.

- [ ] **Step 4: FE domain + repo**

`audit.ts`:

```ts
/** 1 dòng của GET /users/lookup — có phòng ban để lọc thành viên kiểm kê. */
export interface MemberOption {
  id: number;
  fullName: string;
  username: string;
  departmentId: number | null;
}

export function membersOfDepartment(users: MemberOption[], departmentId: number): MemberOption[] {
  return users.filter((u) => u.departmentId === departmentId);
}
```

`AuditRepository.ts` + `HttpAuditRepository.ts`: `users(): Promise<MemberOption[]>` (đổi kiểu, URL giữ nguyên).

- [ ] **Step 5: Component test đỏ**

`AuditMemberPicker.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { AuditMemberPicker } from './AuditMemberPicker';

const departments = [
  { id: 1, departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' },
  { id: 2, departmentCode: 'KETOAN', departmentName: 'Phòng Kế toán' },
];
const users = [
  { id: 7, fullName: 'Nguyễn Văn A', username: 'a', departmentId: 1 },
  { id: 8, fullName: 'Trần Thị B', username: 'b', departmentId: 2 },
];

function Harness({ initial = [] as number[], stale = [] as { id: number; fullName: string; username: string }[] }) {
  const [selected, setSelected] = useState(initial);
  return <AuditMemberPicker users={users} departments={departments} selected={selected} onChange={setSelected} stale={stale} />;
}

it('chưa chọn phòng: chỉ hiện gợi ý, không có checkbox', () => {
  render(<Harness />);
  expect(screen.getByText('Chọn phòng ban để xem nhân viên')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).toBeNull();
});

it('lọc theo phòng, giữ lựa chọn khi đổi phòng, bỏ chọn qua chip', () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Phòng ban'), { target: { value: '1' } });
  fireEvent.click(screen.getByLabelText('Nguyễn Văn A (a)'));
  expect(screen.queryByLabelText('Trần Thị B (b)')).toBeNull();
  fireEvent.change(screen.getByLabelText('Phòng ban'), { target: { value: '2' } });
  fireEvent.click(screen.getByLabelText('Trần Thị B (b)'));
  expect(screen.getByText('Đã chọn (2)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ Nguyễn Văn A' }));
  expect(screen.getByText('Đã chọn (1)')).toBeInTheDocument();
});

it('thành viên ngừng hoạt động: chip có nhãn, bỏ chọn được', () => {
  render(<Harness initial={[99]} stale={[{ id: 99, fullName: 'Cũ', username: 'cu' }]} />);
  expect(screen.getByText(/Cũ — ngừng hoạt động/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ Cũ' }));
  expect(screen.getByText('Đã chọn (0)')).toBeInTheDocument();
});
```

Run `npm test -- AuditMemberPicker` → FAIL (file chưa có).

- [ ] **Step 6: Implement `AuditMemberPicker.tsx`**

```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { Checkbox, Select } from '@/shared/ui/inputs';
import type { UserRef } from '@/modules/device/domain/device';
import { membersOfDepartment, type DepartmentRef, type MemberOption } from '../domain/audit';

/** Thành viên tham gia: lọc theo phòng ban rồi tick; lựa chọn giữ nguyên khi đổi phòng. */
export function AuditMemberPicker({
  users,
  departments,
  selected,
  onChange,
  stale = [],
}: {
  users: MemberOption[];
  departments: DepartmentRef[];
  selected: number[];
  onChange: (ids: number[]) => void;
  stale?: UserRef[];
}) {
  const [departmentId, setDepartmentId] = useState('');
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const deptName = (id: number | null) => departments.find((d) => d.id === id)?.departmentName ?? '';
  const chips = selected.flatMap((id) => {
    const u = users.find((x) => x.id === id);
    if (u) return [{ id, label: `${u.fullName} – ${deptName(u.departmentId)}`, name: u.fullName }];
    const s = stale.find((x) => x.id === id);
    return s ? [{ id, label: `${s.fullName} — ngừng hoạt động`, name: s.fullName }] : [];
  });
  const listed = departmentId ? membersOfDepartment(users, Number(departmentId)) : [];

  return (
    <div className="space-y-3">
      <Select aria-label="Phòng ban" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
        <option value="">Chọn phòng ban</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.departmentName}
          </option>
        ))}
      </Select>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-3">
        {!departmentId ? (
          <p className="text-sm text-ink-muted">Chọn phòng ban để xem nhân viên</p>
        ) : listed.length === 0 ? (
          <p className="text-sm text-ink-muted">Phòng ban chưa có nhân viên đang hoạt động</p>
        ) : (
          listed.map((u) => (
            <div key={u.id}>
              <Checkbox
                id={`audit-member-${u.id}`}
                label={`${u.fullName} (${u.username})`}
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
              />
            </div>
          ))
        )}
      </div>
      <div>
        <p className="mb-2 text-sm text-ink-muted">Đã chọn ({chips.length})</p>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-3 py-1 text-sm text-ink">
              {c.label}
              <button
                type="button"
                aria-label={`Bỏ ${c.name}`}
                className="rounded-full p-0.5 hover:bg-line"
                onClick={() => toggle(c.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
```

(Kiểm `Select` trong `shared/ui/inputs` nhận `aria-label` và children `<option>` — `ScheduleAuditModal` đang dùng đúng kiểu này. Kiểm token màu `bg-surface-sunken`, `bg-line` có trong tailwind config; `DeviceCatalogPage` đang dùng `hover:bg-surface-sunken`.)
Chip "Đã chọn (n)" đếm `chips.length` — id đã chọn mà không có trong `users` lẫn `stale` (không thể xảy ra trong luồng thật) bị bỏ khỏi đếm.

- [ ] **Step 7: Dùng picker ở 2 chỗ**

`ScheduleAuditModal.tsx`: xoá `toggleMember`; thay khối `<Field label="Thành viên tham gia">…</Field>` bằng:

```tsx
<Field label="Thành viên tham gia">
  <AuditMemberPicker
    users={users}
    departments={departments}
    selected={draft.memberIds}
    onChange={(memberIds) => set({ memberIds })}
  />
</Field>
```

Bỏ import `Checkbox` nếu không còn dùng.

`AuditMembersTab.tsx`: lấy thêm danh mục phòng ban khi sửa:

```tsx
const { data: lookups } = useAsyncData(
  () => (editing ? Promise.all([auditService.users(), auditService.departments()]) : Promise.resolve(null)),
  [editing],
);
const [users, departments] = lookups ?? [null, []];
```

Giữ nguyên tính `stale` từ `users`; thay khối `<div className="max-h-72 …">…</div>` bằng
`<AuditMemberPicker users={users ?? []} departments={departments} selected={selected} onChange={setSelected} stale={stale} />`;
xoá `toggle`, bỏ import `Checkbox`.

Sửa test hiện có bị ảnh hưởng: `AuditHomePage.test.tsx` (stub `/users/lookup` thêm `departmentId: 1`; nếu test tick thành viên thì chọn phòng trước), `AuditDetailPage.test.tsx` (test sửa thành viên: chọn `Phòng ban` trước khi tick).

- [ ] **Step 8: Chạy test + lint, commit**

Run: `cd backend && npx jest src/modules/users` ; `npm test -- src/modules/audit` ; `npm run lint`
Expected: PASS.

```bash
git add backend frontend
git commit -m "feat(audit): chọn thành viên kiểm kê theo phòng ban, giữ lựa chọn qua nhiều phòng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Backend — xoá mềm đợt, dọn thùng rác, xoá bảng tổng hợp

**Files:**
- Modify: `backend/src/modules/audits/audit-status.ts`, `audits.dto.ts`, `audits.service.ts`, `audits.controller.ts`,
  `audit-summaries.service.ts`, `audit-summaries.controller.ts`, `backend/src/test/fake-prisma.ts`
- Test: `backend/src/modules/audits/audits.spec.ts` (thêm `describe('Xoá / thùng rác')`)

**Interfaces:**
- Consumes: `ACTOR.ACCT_HEAD`, `ACTOR.ACCT_SPECIALIST` (Task 1).
- Produces:
  - `AUDIT_STATUS.DELETED = 'Đã xóa'`, `DELETABLE_AUDIT_STATUSES = [NOT_STARTED, IN_PROGRESS, APPROVED, CANCELLED]`.
  - `DELETE /audits/:id` → chi tiết đợt (status `Đã xóa`), message `'Đã xoá đợt kiểm kê'`.
  - `POST /audits/purge { ids: number[] }` → `{ count: number, skipped: { id: number; unitName: string; reasons: string[] }[] }`, message `'Đã dọn thùng rác'`.
  - `DELETE /audit-summaries/:id` → `{ id }`, message `'Đã xoá bảng tổng hợp'`.
  - `GET /audits` không có `status` → loại `Đã xóa`.

- [ ] **Step 1: Fake Prisma hỗ trợ xoá**

`backend/src/test/fake-prisma.ts`:

Trong `audit:` (cạnh `delete: jest.fn(forbidden)`) thêm — mô phỏng cascade thật của Postgres (AuditItem → AuditItemAccessory, AuditMember) và RESTRICT của AuditSummaryAudit:

```ts
      // Chỉ /audits/purge dùng. Cascade như migration: AuditItem(+AuditItemAccessory), AuditMember.
      deleteMany: jest.fn(async ({ where }: { where: Where }) => {
        const gone = audits.filter((a) => matches(a, where));
        const ids = new Set(gone.map((a) => a.id));
        if (auditSummaryAudits.some((l) => ids.has(l.auditId))) {
          throw new Error('FK RESTRICT: AuditSummaryAudit.AuditId');
        }
        const itemIds = new Set(auditItems.filter((i) => ids.has(i.auditId)).map((i) => i.id));
        const keep = <T,>(arr: T[], drop: (x: T) => boolean) => {
          for (let k = arr.length - 1; k >= 0; k--) if (drop(arr[k])) arr.splice(k, 1);
        };
        keep(auditItemAccessories, (x) => itemIds.has(x.auditItemId));
        keep(auditItems, (i) => ids.has(i.auditId));
        keep(auditMembers, (m) => ids.has(m.auditId));
        keep(audits, (a) => ids.has(a.id));
        return { count: gone.length };
      }),
```

Thêm model `auditSummaryAudit` (trước `auditSummary:`):

```ts
    auditSummaryAudit: {
      findMany: jest.fn(async ({ where }: { where?: Where }) =>
        auditSummaryAudits.filter((l) => matches(l, where)),
      ),
    },
```

Trong `auditSummary:` thêm:

```ts
      // Cascade AuditSummaryAudit như migration.
      deleteMany: jest.fn(async ({ where }: { where: Where }) => {
        const gone = auditSummaries.filter((s) => matches(s, where));
        for (const s of gone) {
          auditSummaries.splice(auditSummaries.indexOf(s), 1);
          for (let k = auditSummaryAudits.length - 1; k >= 0; k--)
            if (auditSummaryAudits[k].summaryId === s.id) auditSummaryAudits.splice(k, 1);
        }
        return { count: gone.length };
      }),
```

(Nếu file `.ts` không chấp nhận `<T,>` thì viết `function keep<T>(...)` ở ngoài object.)

- [ ] **Step 2: Test đỏ**

Thêm vào cuối `audits.spec.ts` (trong `describe` gốc, dùng helper sẵn có `newAudit`, `post`, `as`, `http`, `acctHead`, `acctCollab` — biến `acctCollab` đã đổi tên ở Task 1 thành gì thì dùng đúng tên đó; `addDevice`, `allocatedTo`, `techStaff`):

```ts
  describe('Xoá / thùng rác', () => {
    const del = (id: number, user: User) => http().delete(`/audits/${id}`).set(as(user));
    const purge = (ids: number[], user: User = acctHead) => post('/audits/purge', user, { ids });

    it('TP Kế toán xoá đợt Chưa kiểm kê → Đã xóa; Chuyên viên bị 403', async () => {
      const a = await newAudit();
      await del(a.id, acctCollab).expect(403);
      const res = await del(a.id, acctHead).expect(200);
      expect(res.body.data.status).toBe('Đã xóa');
    });

    it('không xoá được đợt Chờ duyệt (400)', async () => {
      const a = await newAudit(false);
      await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      await post(`/audits/${a.id}/mark-uncounted-ok`, acctCollab).expect(201);
      await post(`/audits/${a.id}/submit`, acctCollab).expect(201);
      await del(a.id, acctHead).expect(400);
    });

    it('xoá đợt Đang kiểm kê nhả thiết bị — lập đợt mới cho cùng máy được', async () => {
      const a = await newAudit(false);
      await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      await del(a.id, acctHead).expect(200);
      const again = await schedule().expect(201);
      expect(again.body.data.items.map((i: { deviceId: number }) => i.deviceId)).toContain(a.items[0].deviceId);
    });

    it('đợt Đã xóa: mọi thao tác ghi trả 400', async () => {
      const a = await newAudit(false);
      await del(a.id, acctHead).expect(200);
      await post(`/audits/${a.id}/start`, acctCollab).expect(400);
      await http().put(`/audits/${a.id}/members`).set(as(acctCollab)).send({ userIds: [] }).expect(400);
    });

    it('GET /audits mặc định ẩn Đã xóa; lọc status=Đã xóa thì Chuyên viên vẫn xem được', async () => {
      const a = await newAudit(false);
      await del(a.id, acctHead).expect(200);
      const all = await http().get('/audits').set(as(acctCollab)).expect(200);
      expect(all.body.data.map((x: { id: number }) => x.id)).not.toContain(a.id);
      const trash = await http().get('/audits').query({ status: 'Đã xóa' }).set(as(acctCollab)).expect(200);
      expect(trash.body.data.map((x: { id: number }) => x.id)).toEqual([a.id]);
      await http().get(`/audits/${a.id}`).set(as(acctCollab)).expect(200);
    });

    it('purge: xoá cứng đợt Đã xóa, bỏ qua lặng lẽ đợt chưa xoá mềm; Chuyên viên 403', async () => {
      const deleted = await newAudit(false);
      const alive = await newAudit(false);
      await del(deleted.id, acctHead).expect(200);
      await purge([deleted.id, alive.id], acctCollab).expect(403);
      const res = await purge([deleted.id, alive.id]).expect(201);
      expect(res.body.data).toEqual({ count: 1, skipped: [] });
      expect(prisma.audits.map((x) => x.id)).toEqual([alive.id]);
      expect(prisma.auditItems.some((i) => i.auditId === deleted.id)).toBe(false);
    });
  });
```

Thêm test bảng tổng hợp — cần đợt `Đã duyệt`. Dùng chuỗi start → mark-uncounted-ok → submit → approve:

```ts
  describe('Xoá bảng tổng hợp', () => {
    async function approvedAudit() {
      const a = await newAudit(false);
      await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      await post(`/audits/${a.id}/mark-uncounted-ok`, acctCollab).expect(201);
      await post(`/audits/${a.id}/submit`, acctCollab).expect(201);
      await post(`/audits/${a.id}/approve`, acctHead).expect(201);
      return a;
    }

    it('đợt nằm trong bảng tổng hợp: purge bỏ qua kèm lý do; xoá bảng rồi purge được', async () => {
      const a = await approvedAudit();
      const s = await post('/audit-summaries', acctCollab, { title: 'Q3', auditIds: [a.id] }).expect(201);
      await http().delete(`/audits/${a.id}`).set(as(acctHead)).expect(200);
      const first = await post('/audits/purge', acctHead, { ids: [a.id] }).expect(201);
      expect(first.body.data).toEqual({
        count: 0,
        skipped: [{ id: a.id, unitName: 'Phòng Kỹ thuật', reasons: [`bảng tổng hợp #${s.body.data.id}`] }],
      });
      await http().delete(`/audit-summaries/${s.body.data.id}`).set(as(acctCollab)).expect(403);
      await http().delete(`/audit-summaries/${s.body.data.id}`).set(as(acctHead)).expect(200);
      await http().get(`/audit-summaries/${s.body.data.id}`).set(as(acctHead)).expect(404);
      const second = await post('/audits/purge', acctHead, { ids: [a.id] }).expect(201);
      expect(second.body.data.count).toBe(1);
    });

    it('xoá bảng tổng hợp không tồn tại: 404', async () => {
      await http().delete('/audit-summaries/999').set(as(acctHead)).expect(404);
    });
  });
```

(Kiểm mã HTTP thực tế của `start/submit/approve` trong spec hiện có — nếu là `200` thay `201` tương ứng. Kiểm `unitName` mà `schedule()` mặc định tạo ra.)

Run: `cd backend && npx jest src/modules/audits`
Expected: FAIL — route chưa có (404), list chưa ẩn.

- [ ] **Step 3: Hằng số + DTO**

`audit-status.ts`:

```ts
export const AUDIT_STATUS = {
  NOT_STARTED: 'Chưa kiểm kê',
  IN_PROGRESS: 'Đang kiểm kê',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  CANCELLED: 'Đã hủy',
  DELETED: 'Đã xóa',
} as const;

/** Xoá mềm được ở mọi trạng thái trừ Chờ duyệt (và đã xoá). */
export const DELETABLE_AUDIT_STATUSES: string[] = [
  AUDIT_STATUS.NOT_STARTED,
  AUDIT_STATUS.IN_PROGRESS,
  AUDIT_STATUS.APPROVED,
  AUDIT_STATUS.CANCELLED,
];
```

`audits.dto.ts` thêm (import `ArrayMinSize, IsArray, IsInt, Max, Min` và `Type` nếu chưa có; `MAX_INT32` từ `../users/users.dto`):

```ts
export class PurgeAuditsDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  ids!: number[];
}
```

- [ ] **Step 4: Service**

`audits.service.ts`:

`list()` — dòng `status: q.status,` thành:

```ts
        // Thùng rác chỉ hiện khi lọc đúng "Đã xóa".
        status: q.status ?? { not: AUDIT_STATUS.DELETED },
```

Thêm 2 method (sau `cancel`):

```ts
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
```

Import `DELETABLE_AUDIT_STATUSES`.

`audit-summaries.service.ts` thêm:

```ts
  /** Xoá cứng (không thùng rác). Liên kết đợt đi theo cascade; các đợt giữ nguyên. */
  async remove(id: number) {
    if (Math.abs(id) > MAX_INT32) throw new NotFoundException(SUMMARY_NOT_FOUND);
    const { count } = await this.prisma.auditSummary.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundException(SUMMARY_NOT_FOUND);
    return { id };
  }
```

- [ ] **Step 5: Controller**

`audits.controller.ts` (import `Delete`, `PurgeAuditsDto`; đặt `purge` trước các route `':id'`):

```ts
  /** Dọn thùng rác (xoá cứng) — chỉ TP Kế toán. */
  @Post('purge')
  @Allow(ACTOR.ACCT_HEAD)
  @ResponseMessage('Đã dọn thùng rác')
  purge(@Body() dto: PurgeAuditsDto) {
    return this.audits.purge(dto.ids);
  }

  @Delete(':id')
  @Allow(ACTOR.ACCT_HEAD)
  @ResponseMessage('Đã xoá đợt kiểm kê')
  remove(@AuditId() id: number) {
    return this.audits.remove(id);
  }
```

`audit-summaries.controller.ts` (import `Delete`):

```ts
  @Delete(':id')
  @Allow(ACTOR.ACCT_HEAD)
  @ResponseMessage('Đã xoá bảng tổng hợp')
  remove(@SummaryId() id: number) {
    return this.summaries.remove(id);
  }
```

Sửa comment class `AuditsController`: "Kiểm kê: CHỈ TP Kế toán + Chuyên viên Kế toán".

- [ ] **Step 6: Chạy toàn bộ BE**

Run: `cd backend && npx jest`
Expected: PASS. `devices.service.purge` vẫn chặn thiết bị có `AuditItem` — đợt bị dọn thì máy đó hết bị chặn, đúng mong muốn.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(audit-be): xoá mềm đợt kiểm kê, dọn thùng rác, xoá bảng tổng hợp (TP Kế toán)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — nút Xoá, thùng rác, xoá bảng tổng hợp

**Files:**
- Modify: `frontend/src/modules/audit/domain/audit.ts`, `application/AuditRepository.ts`, `infrastructure/HttpAuditRepository.ts`,
  `presentation/auditStatusTone.ts`, `presentation/AuditListTab.tsx`, `presentation/AuditDetailPage.tsx`,
  `presentation/SummaryListTab.tsx`, `presentation/AuditSummaryPage.tsx`, `frontend/src/modules/auth/domain/session.ts`
- Test: `HttpAuditRepository.test.ts`, `AuditHomePage.test.tsx`, `AuditDetailPage.test.tsx`, `AuditSummaryPage.test.tsx`, `session.test.ts`

**Interfaces:**
- Consumes: endpoint Task 5.
- Produces:
  - FE `AUDIT_STATUS.DELETED = 'Đã xóa'`, `DELETABLE_AUDIT_STATUSES: AuditStatus[]`, `canDeleteAudits: Can = isAcctHead`.
  - `PurgeResult = { count: number; skipped: { id: number; unitName: string; reasons: string[] }[] }`.
  - Repo/service: `remove(id): Promise<AuditDetail>`, `purge(ids: number[]): Promise<PurgeResult>`, `removeSummary(id): Promise<void>`.

- [ ] **Step 1: Test đỏ — repository + quyền**

`HttpAuditRepository.test.ts` thêm (theo mẫu test sẵn có trong file, stub `fetch` trả envelope):

```ts
it('remove → DELETE /audits/:id; purge → POST /audits/purge {ids}; removeSummary → DELETE /audit-summaries/:id', async () => {
  const fetchMock = stubFetch({ count: 1, skipped: [] }); // dùng helper sẵn có trong file, hoặc vi.fn trả envelope
  const repo = new HttpAuditRepository();
  await repo.remove(3);
  await repo.purge([3, 4]);
  await repo.removeSummary(5);
  const calls = fetchMock.mock.calls.map(([u, init]) => [String(u).replace(/^.*\/api/, ''), init?.method, init?.body ?? null]);
  expect(calls).toEqual([
    ['/audits/3', 'DELETE', null],
    ['/audits/purge', 'POST', JSON.stringify({ ids: [3, 4] })],
    ['/audit-summaries/5', 'DELETE', null],
  ]);
});
```

(Đọc đầu file test để biết cách cắt base URL — sửa `replace` cho khớp.)

`session.test.ts` thêm: `canDeleteAudits` true với TP Kế toán, false với Chuyên viên Kế toán, TP Kỹ thuật, Admin (chép mẫu `as(...)` sẵn có).

Run `npm test -- src/modules/audit/infrastructure src/modules/auth` → FAIL.

- [ ] **Step 2: Implement domain / repo / service / quyền**

`audit.ts`: thêm `DELETED: 'Đã xóa'` vào `AUDIT_STATUS`; thêm

```ts
export const DELETABLE_AUDIT_STATUSES: AuditStatus[] = [
  AUDIT_STATUS.NOT_STARTED,
  AUDIT_STATUS.IN_PROGRESS,
  AUDIT_STATUS.APPROVED,
  AUDIT_STATUS.CANCELLED,
];

export interface PurgeResult {
  count: number;
  skipped: { id: number; unitName: string; reasons: string[] }[];
}
```

`auditStatusTone.ts`: `[AUDIT_STATUS.DELETED]: 'neutral',`.

`AuditRepository.ts` interface thêm `remove(id: number): Promise<AuditDetail>; purge(ids: number[]): Promise<PurgeResult>; removeSummary(id: number): Promise<void>;`
và `makeAuditService` thêm `remove: (id) => repo.remove(id), purge: (ids) => repo.purge(ids), removeSummary: (id) => repo.removeSummary(id),`.

`HttpAuditRepository.ts` (import `apiDelete`):

```ts
  remove(id: number): Promise<AuditDetail> {
    return apiDelete<AuditDetail>(`/audits/${id}`);
  }
  purge(ids: number[]): Promise<PurgeResult> {
    return apiPost<PurgeResult>('/audits/purge', { ids });
  }
  async removeSummary(id: number): Promise<void> {
    await apiDelete<unknown>(`/audit-summaries/${id}`);
  }
```

`session.ts`:

```ts
/** Xoá đợt, dọn thùng rác, xoá bảng tổng hợp: CHỈ Trưởng phòng Kế toán. */
export const canDeleteAudits = isAcctHead;
```

Run lại Step 1 → PASS.

- [ ] **Step 3: Test đỏ — UI**

`AuditHomePage.test.tsx`: mở rộng `fetchMock` — `DELETE /audits/1` trả `{...audit(1), status: 'Đã xóa', items: [], members: []}`; `POST /audits/purge` trả
`{ count: 0, skipped: [{ id: 1, unitName: 'Phòng Kỹ thuật', reasons: ['bảng tổng hợp #4'] }] }`; `DELETE /audit-summaries/4` trả `{ id: 4 }`.
(Đặt các nhánh `DELETE` / `purge` **trước** nhánh `u.includes('/audits')` chung.) Thêm test, stub `window.confirm` → true:

```tsx
it('TP Kế toán: có nút Xoá ở dòng, xác nhận → DELETE', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderPage('Trưởng phòng');
  fireEvent.click(await screen.findByRole('button', { name: 'Xoá' }));
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/audits/1') && i?.method === 'DELETE')).toBe(true),
  );
});

it('Chuyên viên Kế toán: không có Xoá; lọc Đã xóa vẫn xem được nhưng không có Dọn thùng rác', async () => {
  renderPage('Chuyên viên');
  await screen.findByText('Phòng Kỹ thuật');
  expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
  fireEvent.change(screen.getByDisplayValue('Trạng thái (Tất cả)'), { target: { value: 'Đã xóa' } });
  await screen.findByText('Phòng Kỹ thuật');
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});

it('TP Kế toán: Dọn thùng rác → hiện đợt bị giữ lại kèm lý do', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderPage('Trưởng phòng');
  await screen.findByText('Phòng Kỹ thuật');
  fireEvent.change(screen.getByDisplayValue('Trạng thái (Tất cả)'), { target: { value: 'Đã xóa' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Dọn thùng rác' }));
  expect(await screen.findByText(/Đợt #1 \(Phòng Kỹ thuật\): bảng tổng hợp #4/)).toBeInTheDocument();
});

it('TP Kế toán: tab Tổng hợp có Xoá bảng → DELETE /audit-summaries/4', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderPage('Trưởng phòng', '/audit?tab=summary');
  fireEvent.click(await screen.findByRole('button', { name: 'Xoá' }));
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/audit-summaries/4') && i?.method === 'DELETE')).toBe(true),
  );
});
```

`AuditDetailPage.test.tsx` thêm:
- TP Kế toán, đợt `Đã duyệt` → có nút "Xoá đợt"; bấm (confirm true) → badge `Đã xóa` hiện, nút "Xoá đợt" biến mất.
- TP Kế toán, đợt `Chờ duyệt` → không có "Xoá đợt".
- Chuyên viên, đợt `Đã xóa` → không có "Bắt đầu kiểm kê" / "Sửa thành viên" / "Xoá đợt" (chỉ còn Xuất CSV / PDF).

Run `npm test -- src/modules/audit/presentation` → FAIL.

- [ ] **Step 4: `AuditListTab.tsx`**

```tsx
const { session } = useSession();
const canDelete = canDeleteAudits(session);
const [reloadKey, setReloadKey] = useState(0);
const { data, loading, error } = useAsyncData(
  () => auditService.list({ q: q || undefined, status: status || undefined }),
  [q, status, reloadKey],
);
const [skipped, setSkipped] = useState<PurgeResult['skipped']>([]);

const del = useAsyncAction(async (a: Audit) => {
  if (!window.confirm(`Xoá đợt kiểm kê #${a.id} (${a.unitName})? Đợt sẽ vào thùng rác.`)) return;
  await auditService.remove(a.id);
  setReloadKey((k) => k + 1);
});
const purge = useAsyncAction(async () => {
  const ids = (data ?? []).map((a) => a.id);
  if (ids.length === 0) return;
  if (!window.confirm(`Xoá vĩnh viễn ${ids.length} đợt kiểm kê? Không thể khôi phục.`)) return;
  const res = await auditService.purge(ids);
  setSkipped(res.skipped);
  setReloadKey((k) => k + 1);
});
```

Cột `actions`: trước nút "Xem", thêm

```tsx
{canDelete && DELETABLE_AUDIT_STATUSES.includes(a.status) && (
  <Button size="sm" variant="outline" disabled={del.pending} onClick={() => void del.run(a)}>
    Xoá
  </Button>
)}
```

(bọc 2 nút trong `<div className="flex justify-end gap-2">`).
Thanh lọc: sau `<Select>` thêm

```tsx
{canDelete && status === AUDIT_STATUS.DELETED && (data?.length ?? 0) > 0 && (
  <Button variant="outline" size="sm" disabled={purge.pending} onClick={() => void purge.run()}>
    Dọn thùng rác
  </Button>
)}
```

Dưới thanh lọc, hiện lỗi `del.error ?? purge.error ?? error`, và nếu `skipped.length`:

```tsx
<div role="status" className="mb-3 rounded-lg bg-status-warnBg px-4 py-3 text-sm text-status-warnFg">
  Không xoá được {skipped.length} đợt:
  <ul className="mt-1 list-disc pl-5">
    {skipped.map((s) => (
      <li key={s.id}>Đợt #{s.id} ({s.unitName}): {s.reasons.join(', ')}</li>
    ))}
  </ul>
</div>
```

(Kiểm token `status-warnBg/warnFg` có trong tailwind config; nếu không, dùng cặp token cảnh báo đang có trong `Badge`.)
Gọi `setSkipped([])` khi đổi bộ lọc `status`.

- [ ] **Step 5: `AuditDetailPage.tsx`**

Đổi biến `isCollab` → `isSpecialist` (nếu Task 1 chưa đổi). Thêm `const canDelete = canDeleteAudits(session);` và:

```tsx
const remove = () => {
  if (window.confirm('Xoá đợt kiểm kê này? Đợt sẽ vào thùng rác; trạng thái thiết bị đã đổi không được hoàn tác.')) {
    void act.run(() => auditService.remove(auditId));
  }
};
```

Thanh nút cuối trang, thêm:

```tsx
{canDelete && DELETABLE_AUDIT_STATUSES.includes(status) && (
  <Button variant="outline" disabled={act.pending} onClick={remove}>
    Xoá đợt
  </Button>
)}
```

Các nút khác đã phụ thuộc trạng thái nên đợt `Đã xóa` tự chỉ còn Xuất CSV / PDF.

- [ ] **Step 6: Bảng tổng hợp**

`SummaryListTab.tsx`: thêm `reloadKey` vào deps `useAsyncData`; `canDelete = canDeleteAudits(session)`;

```tsx
const del = useAsyncAction(async (s: AuditSummary) => {
  if (!window.confirm(`Xoá bảng tổng hợp "${s.title}"? Không thể hoàn tác.`)) return;
  await auditService.removeSummary(s.id);
  setReloadKey((k) => k + 1);
});
```

Cột actions: nút `Xoá` (khi `canDelete`) cạnh `Xem`; hiện `del.error ?? error`.

`AuditSummaryPage.tsx`: `useNavigate`, `useSession`; `canDeleteAudits(session)` → trong `actions` header thêm

```tsx
<Button
  variant="outline"
  size="sm"
  disabled={del.pending}
  onClick={() => void del.run(s)}
>
  Xoá
</Button>
```

với `del = useAsyncAction(async (x: AuditSummaryDetail) => { if (!window.confirm(\`Xoá bảng tổng hợp "${x.title}"? Không thể hoàn tác.\`)) return; await auditService.removeSummary(x.id); navigate('/audit?tab=summary'); })`; hiện `del.error`.
`AuditSummaryPage.test.tsx` thêm: TP Kế toán bấm Xoá (confirm true) → gọi `DELETE /audit-summaries/:id`; Chuyên viên không thấy nút.

- [ ] **Step 7: Chạy test + lint**

Run: `npm test` và `npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat(audit-fe): xoá đợt, thùng rác (Chuyên viên chỉ xem), xoá bảng tổng hợp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Đổi nhãn `Chờ thanh lý` → `Chờ xử lý` và `Đơn vị kiểm kê` → `Đơn vị được kiểm kê`

**Files:**
- Create: `backend/prisma/migrations/20261008100000_rename_pending_disposal/migration.sql`
- Modify BE: `backend/src/modules/devices/device-status.ts`, `backend/src/modules/audits/audits.service.ts:478`, `backend/src/modules/audits/audits.spec.ts`
- Modify FE: `frontend/src/modules/device/domain/device.ts`, `frontend/src/modules/device/presentation/statusTone.ts`,
  `frontend/src/modules/dashboard/infrastructure/InMemoryDashboardRepository.ts:12`, `frontend/src/modules/audit/presentation/AuditDetailPage.tsx:69`,
  `frontend/src/modules/audit/domain/audit.ts:25`, `frontend/src/modules/audit/domain/validateAuditDraft.ts:25`,
  `frontend/src/modules/audit/presentation/AuditListTab.tsx:26`, `frontend/src/modules/audit/presentation/ScheduleAuditModal.tsx:84`,
  `frontend/src/modules/audit/presentation/print/generateAuditReport.ts:11`
- Test: `validateAuditDraft.test.ts`, `AuditHomePage.test.tsx`, `generateAuditReport.test.ts`, test thiết bị có `Chờ thanh lý`

**Interfaces:**
- Produces: BE/FE `DEVICE_STATUS.PENDING_PROCESSING = 'Chờ xử lý'` (thay `PENDING_DISPOSAL`).

- [ ] **Step 1: Đổi chuỗi trong test (đỏ)**

```bash
grep -rlE "Chờ thanh lý|[Đđ]ơn vị kiểm kê" backend/src frontend/src --include=*.spec.ts --include=*.test.ts --include=*.test.tsx \
  | xargs sed -i 's/Chờ thanh lý/Chờ xử lý/g; s/Đơn vị kiểm kê/Đơn vị được kiểm kê/g; s/đơn vị kiểm kê/đơn vị được kiểm kê/g'
```

Run: `cd backend && npx jest src/modules/audits` ; `npm test -- src/modules/audit src/modules/device`
Expected: FAIL (nhãn cũ trong code).

- [ ] **Step 2: Đổi code**

```bash
grep -rl "PENDING_DISPOSAL" backend/src frontend/src | xargs sed -i 's/PENDING_DISPOSAL/PENDING_PROCESSING/g'
grep -rlE "Chờ thanh lý|[Đđ]ơn vị kiểm kê" backend/src frontend/src --include=*.ts --include=*.tsx \
  | xargs sed -i 's/Chờ thanh lý/Chờ xử lý/g; s/Đơn vị kiểm kê/Đơn vị được kiểm kê/g; s/đơn vị kiểm kê/đơn vị được kiểm kê/g'
```

Kiểm tay kết quả ở `ScheduleAuditModal.tsx` (label), `AuditListTab.tsx` (cột), `generateAuditReport.ts` (`` `Đơn vị được kiểm kê: ${a.unitName}` ``),
`validateAuditDraft.ts` (`'Vui lòng chọn đơn vị được kiểm kê'`), `AuditDetailPage.tsx` (`"Hỏng" sẽ chuyển Chờ xử lý`), dashboard mock (`label: 'Chờ xử lý'`).
Tên field `unit` / `unitName` **không** đổi.

- [ ] **Step 3: Migration**

`backend/prisma/migrations/20261008100000_rename_pending_disposal/migration.sql`:

```sql
-- Đổi nhãn trạng thái thiết bị; AuditItem.DeviceStatus là ảnh chụp lúc lập lịch — đổi theo để biên bản cũ thống nhất.
UPDATE "Device" SET "Status" = 'Chờ xử lý' WHERE "Status" = 'Chờ thanh lý';
UPDATE "AuditItem" SET "DeviceStatus" = 'Chờ xử lý' WHERE "DeviceStatus" = 'Chờ thanh lý';
```

- [ ] **Step 4: Chạy toàn bộ test + lint**

Run: `cd backend && npx jest` ; `npm test` ; `npm run lint`
Expected: PASS. `grep -rn "Chờ thanh lý\|Đơn vị kiểm kê\|PENDING_DISPOSAL" backend/src frontend/src` → trống.

- [ ] **Step 5: Commit**

```bash
git add backend frontend
git commit -m "feat: đổi nhãn Chờ thanh lý thành Chờ xử lý (migration) và Đơn vị kiểm kê thành Đơn vị được kiểm kê

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tài liệu

**Files:**
- Modify: `docs/CONTEXT.md`, `docs/erd.dbml`, `docs/superpowers/specs/2026-10-08-phong-ban-chuc-vu-xoa-kiem-ke-design.md`

- [ ] **Step 1: Cập nhật**

- `docs/CONTEXT.md`: ma trận quyền (CTV → Chuyên viên; thêm dòng "Xoá đợt / dọn thùng rác / xoá bảng tổng hợp kiểm kê: TP Kế toán"),
  danh sách phòng ban 4 mã, quy tắc chức vụ theo phòng, thùng rác kiểm kê, nhãn `Chờ xử lý`. `grep -n "Cộng tác viên\|CTV\|Chờ thanh lý" docs/CONTEXT.md` → sửa hết.
- `docs/erd.dbml`: note giá trị `Role.RoleName` (`Chuyên viên`), `Audit.Status` thêm `Đã xóa`, `Device.Status` `Chờ xử lý`. Không thêm cột.
- Spec §5 Frontend: sửa "tick chọn + Dọn thùng rác" thành "**Dọn thùng rác** xoá toàn bộ đợt đang hiện trong bộ lọc `Đã xóa` (giống màn thiết bị)".

- [ ] **Step 2: Kiểm cuối**

Run: `cd backend && npx jest` ; `npm test` ; `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: cập nhật CONTEXT/ERD cho phòng ban, Chuyên viên, thùng rác kiểm kê, Chờ xử lý

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Liệt kê placeholder còn lại** (quy ước CLAUDE.md) trong tin nhắn bàn giao: chưa có frame Figma cho picker thành viên; nút Xuất dữ liệu thiết bị vẫn chưa có handler (ngoài phạm vi); DB thật cần chạy `npm run db:setup` trong `backend/` để áp 2 migration + seed 2 phòng ban.
