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
