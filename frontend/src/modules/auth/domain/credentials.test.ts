import { describe, expect, it } from 'vitest';
import {
  Email,
  InvalidEmailError,
  validateCredentials,
  validatePasswordReset,
} from './credentials';

describe('Email', () => {
  it('normalises case and whitespace', () => {
    expect(Email.of('  Han@Example.COM ').value).toBe('han@example.com');
  });

  it('rejects malformed addresses', () => {
    expect(() => Email.of('not-an-email')).toThrow(InvalidEmailError);
    expect(Email.isValid('a@b')).toBe(false);
    expect(Email.isValid('a@b.vn')).toBe(true);
  });
});

describe('validateCredentials', () => {
  it('flags empty username and short password', () => {
    expect(validateCredentials({ username: '', password: '123' })).toHaveLength(2);
  });

  it('passes a valid pair', () => {
    expect(validateCredentials({ username: 'han', password: 'secret1' })).toEqual([]);
  });
});

describe('validatePasswordReset', () => {
  it('requires a match and a minimum length', () => {
    expect(validatePasswordReset('abcdef', 'abcdef')).toEqual([]);
    expect(validatePasswordReset('abcdef', 'abcdeg')).toContain('Mật khẩu xác nhận không khớp');
    expect(validatePasswordReset('x', 'x').length).toBeGreaterThan(0);
  });
});
