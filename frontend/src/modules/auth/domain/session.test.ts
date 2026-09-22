import { expect, it } from 'vitest';
import { fakeJwt } from '@/test/fakeJwt';
import { canWriteDevices, isAdmin, isTokenExpired, type AuthSession } from './session';

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
