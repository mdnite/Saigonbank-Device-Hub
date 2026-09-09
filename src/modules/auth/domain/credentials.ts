/** Domain rules for auth inputs — pure, framework-free, unit-tested. */

export class InvalidEmailError extends Error {
  constructor(value: string) {
    super(`Email không hợp lệ: "${value}"`);
    this.name = 'InvalidEmailError';
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email value object — construct only via `Email.of`, guaranteeing a valid shape. */
export class Email {
  private constructor(public readonly value: string) {}

  static of(raw: string): Email {
    const trimmed = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) throw new InvalidEmailError(raw);
    return new Email(trimmed);
  }

  static isValid(raw: string): boolean {
    return EMAIL_RE.test(raw.trim().toLowerCase());
  }

  toString(): string {
    return this.value;
  }
}

export interface Credentials {
  username: string;
  password: string;
}

export const PASSWORD_MIN_LENGTH = 6;

export function validateCredentials({ username, password }: Credentials): string[] {
  const errors: string[] = [];
  if (username.trim().length === 0) errors.push('Vui lòng nhập tên đăng nhập');
  if (password.length < PASSWORD_MIN_LENGTH)
    errors.push(`Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`);
  return errors;
}

export function validatePasswordReset(password: string, confirm: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH)
    errors.push(`Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`);
  if (password !== confirm) errors.push('Mật khẩu xác nhận không khớp');
  return errors;
}
