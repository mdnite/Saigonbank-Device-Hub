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
