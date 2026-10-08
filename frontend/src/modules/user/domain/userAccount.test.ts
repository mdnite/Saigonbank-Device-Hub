import { describe, expect, it } from 'vitest';
import { NO_DEPARTMENT, allowedRoleNames, emptyNewUserDraft, validateNewUser } from './userAccount';

const valid = {
  ...emptyNewUserDraft(),
  username: 'tp.ketoan',
  fullName: 'Trưởng phòng Kế toán',
  email: 'tp@saigonbank.com.vn',
  password: 'Init@123',
  confirmPassword: 'Init@123',
  roleId: '2',
};

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
      password: 'Mật khẩu phải có ít nhất 6 ký tự',
      confirmPassword: 'Mật khẩu xác nhận không khớp',
    });
  });
});
