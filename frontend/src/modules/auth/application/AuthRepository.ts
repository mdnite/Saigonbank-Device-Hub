import type { Credentials } from '../domain/credentials';
import type { AuthSession } from '../domain/session';

/** Port for the auth backend. Infrastructure provides the adapter. */
export interface AuthRepository {
  login(credentials: Credentials): Promise<AuthSession>;
  /** Sends a reset code to the given email. Resolves when accepted. */
  requestPasswordReset(email: string): Promise<void>;
  /** Verifies the emailed code. Rejects on mismatch. */
  verifyResetCode(email: string, code: string): Promise<void>;
  /** Sets a new password for a verified reset request. */
  resetPassword(email: string, newPassword: string): Promise<void>;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
