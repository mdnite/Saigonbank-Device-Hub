import { expect, it } from 'vitest';
import { fakeJwt } from '@/test/fakeJwt';
import { canWriteDevices, canDeleteDevices, canAccessOrders, canCreateOrder, canDecideOrder, canAccessTransfers, canCreateTransfer, canDecideTransfer, isAdmin, isTokenExpired, canAccessAudits, canCreateAudit, canDecideAudit, canDeleteAudits, canMarkDeviceFound, type AuthSession } from './session';

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
const techCollab = as('Chuyên viên', 'KYTHUAT');
// Không khớp vai nào: Kế toán, không phòng ban (dữ liệu cũ), Nhân viên, chưa đăng nhập.
const outsiders = [
  as('Trưởng phòng', 'KETOAN'),
  as('Chuyên viên', 'KETOAN'),
  as('Trưởng phòng', null),
  as('Chuyên viên', null),
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

const acctHead = as('Trưởng phòng', 'KETOAN');
const acctCollab = as('Chuyên viên', 'KETOAN');
// Kiểm kê chỉ cho Kế toán: Admin, cả 2 vai Kỹ thuật, Nhân viên Kế toán, không phòng ban, chưa đăng nhập đều không.
const notAccounting = [admin, techHead, techCollab, as('Nhân viên', 'KETOAN'), as('Trưởng phòng', null), null];

it.each([
  ['canAccessAudits', canAccessAudits, true, true],
  ['canCreateAudit', canCreateAudit, false, true],
  ['canDecideAudit', canDecideAudit, true, false],
])('%s: TP Kế toán / CTV Kế toán', (_name, can, forHead, forCollab) => {
  expect(can(acctHead)).toBe(forHead);
  expect(can(acctCollab)).toBe(forCollab);
  for (const s of notAccounting) expect(can(s)).toBe(false);
});

it('canDeleteAudits: chỉ Trưởng phòng Kế toán', () => {
  expect(canDeleteAudits(acctHead)).toBe(true);
  for (const s of [acctCollab, techHead, admin, null]) expect(canDeleteAudits(s)).toBe(false);
});

it('canMarkDeviceFound: chỉ Trưởng phòng Kỹ thuật', () => {
  expect(canMarkDeviceFound(techHead)).toBe(true);
  for (const s of [admin, techCollab, acctHead, acctCollab, null]) {
    expect(canMarkDeviceFound(s)).toBe(false);
  }
});
