import { describe, expect, it } from 'vitest';
import { emptyUserSettings, validateUserSettings } from './userSettings';

describe('validateUserSettings', () => {
  it('reports every required general-info field on an empty form', () => {
    const errors = validateUserSettings(emptyUserSettings());
    expect(Object.keys(errors).sort()).toEqual(
      ['department', 'email', 'employeeCode', 'fullName', 'title'].sort(),
    );
  });

  it('rejects a malformed email but accepts a well-formed one', () => {
    const base = {
      ...emptyUserSettings(),
      fullName: 'Hàn',
      department: 'Khối Vận hành',
      title: 'Nhân viên',
      employeeCode: 'NV001',
    };
    expect(validateUserSettings({ ...base, email: 'han(at)sgb' }).email).toBe('Email không hợp lệ');
    expect(validateUserSettings({ ...base, email: 'han@saigonbank.com.vn' })).toEqual({});
  });
});
