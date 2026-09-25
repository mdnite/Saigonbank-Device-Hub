import { expect, it } from 'vitest';
import { fakeJwt } from '@/test/fakeJwt';
import { canWriteDevices, canAccessOrders, canCreateOrder, canDecideOrder, canAccessTransfers, canCreateTransfer, canDecideTransfer, isAdmin, isTokenExpired, type AuthSession } from './session';

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

it('cho phép Quản trị viên ghi thiết bị', () => {
  expect(canWriteDevices({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(true);
});
it('cho phép Trưởng phòng Kỹ thuật ghi thiết bị', () => {
  expect(canWriteDevices({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(true);
});
it('chặn Trưởng phòng Kế toán', () => {
  expect(canWriteDevices({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KETOAN' })).toBe(false);
});
it('chặn Nhân viên', () => {
  expect(canWriteDevices({ ...base, roleName: 'Nhân viên', departmentCode: 'KYTHUAT' })).toBe(false);
});

it('canAccessOrders: Admin hoặc Trưởng phòng Kỹ thuật', () => {
  expect(canAccessOrders({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(true);
  expect(canAccessOrders({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(true);
  expect(canAccessOrders({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KETOAN' })).toBe(false);
  expect(canAccessOrders(base)).toBe(false);
});
it('canCreateOrder: CHỈ Trưởng phòng Kỹ thuật, không gồm Admin', () => {
  expect(canCreateOrder({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(true);
  expect(canCreateOrder({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(false);
});
it('canDecideOrder: CHỈ Admin, không gồm Trưởng phòng Kỹ thuật', () => {
  expect(canDecideOrder({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(true);
  expect(canDecideOrder({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(false);
});
it('canAccessTransfers: Admin hoặc Trưởng phòng Kỹ thuật', () => {
  expect(canAccessTransfers({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(true);
  expect(canAccessTransfers({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(true);
  expect(canAccessTransfers({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KETOAN' })).toBe(false);
  expect(canAccessTransfers(base)).toBe(false);
});
it('canCreateTransfer: CHỈ Admin, không gồm Trưởng phòng Kỹ thuật', () => {
  expect(canCreateTransfer({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(true);
  expect(canCreateTransfer({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(false);
});
it('canDecideTransfer: CHỈ Trưởng phòng Kỹ thuật, không gồm Admin', () => {
  expect(canDecideTransfer({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(true);
  expect(canDecideTransfer({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(false);
});
