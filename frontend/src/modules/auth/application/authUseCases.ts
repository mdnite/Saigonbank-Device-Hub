import {
  Email,
  validateCredentials,
  validatePasswordReset,
  type Credentials,
} from '../domain/credentials';
import type { AuthSession } from '../domain/session';
import { AuthError, type AuthRepository } from './AuthRepository';

/**
 * Application services for the auth bounded context. Each takes its dependencies
 * explicitly so presentation stays free of wiring and tests can pass fakes.
 */
export function makeAuthService(repo: AuthRepository) {
  return {
    async login(credentials: Credentials): Promise<AuthSession> {
      const errors = validateCredentials(credentials);
      if (errors.length) throw new AuthError(errors[0]);
      return repo.login(credentials);
    },

    async requestPasswordReset(rawEmail: string): Promise<void> {
      const email = Email.of(rawEmail); // throws InvalidEmailError
      return repo.requestPasswordReset(email.value);
    },

    async verifyResetCode(rawEmail: string, code: string): Promise<void> {
      if (!/^\d{4}$/.test(code)) throw new AuthError('Mã xác thực gồm 4 chữ số');
      return repo.verifyResetCode(Email.of(rawEmail).value, code);
    },

    async resetPassword(rawEmail: string, password: string, confirm: string): Promise<void> {
      const errors = validatePasswordReset(password, confirm);
      if (errors.length) throw new AuthError(errors[0]);
      return repo.resetPassword(Email.of(rawEmail).value, password);
    },
  };
}

export type AuthService = ReturnType<typeof makeAuthService>;
