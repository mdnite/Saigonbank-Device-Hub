import { expect, it } from 'vitest';
import { fakeJwt } from '@/test/fakeJwt';
import { canWriteDevices, canDeleteDevices, canAccessOrders, canCreateOrder, canDecideOrder, canAccessTransfers, canCreateTransfer, canDecideTransfer, isAdmin, isTokenExpired, type AuthSession } from './session';

const base: AuthSession = {
  userId: '1',
  displayName: 'A',
  email: 'a@b.vn',
  token: 't',
  roleName: 'Nhân viên',
  departmentCode: null,
};

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

const as = (roleName: string, departmentCode: string | null): AuthSession => ({ ...base, roleName, departmentCode });
const admin = as('Quản trị viên', null);
const techHead = as('Trưởng phòng', 'KYTHUAT');
const techCollab = as('Cộng tác viên', 'KYTHUAT');
// Không khớp vai nào: Kế toán, không phòng ban (dữ liệu cũ), Nhân viên, chưa đăng nhập.
const outsiders = [
  as('Trưởng phòng', 'KETOAN'),
  as('Cộng tác viên', 'KETOAN'),
  as('Trưởng phòng', null),
  as('Cộng tác viên', null),
  as('Nhân viên', 'KYTHUAT'),
  null,
];

it.each([
  ['canWriteDevices', canWriteDevices, false, true, true],
  ['canDeleteDevices', canDeleteDevices, false, true, false],
  ['canAccessOrders', canAccessOrders, true, true, true],
  ['canCreateOrder', canCreateOrder, false, false, true],
  ['canDecideOrder', canDecideOrder, false, true, false],
  ['canAccessTransfers', canAccessTransfers, true, true, true],
  ['canCreateTransfer', canCreateTransfer, false, false, true],
  ['canDecideTransfer', canDecideTransfer, false, true, false],
])('%s: Admin / TP Kỹ thuật / CTV Kỹ thuật', (_name, can, forAdmin, forHead, forCollab) => {
  expect(can(admin)).toBe(forAdmin);
  expect(can(techHead)).toBe(forHead);
  expect(can(techCollab)).toBe(forCollab);
  for (const s of outsiders) expect(can(s)).toBe(false);
});
