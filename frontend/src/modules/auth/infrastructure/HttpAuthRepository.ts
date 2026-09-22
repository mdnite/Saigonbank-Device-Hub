import { apiPost } from '@/shared/lib/apiClient';
import type { Credentials } from '../domain/credentials';
import type { AuthSession } from '../domain/session';
import type { AuthRepository } from '../application/AuthRepository';

/** `data` của POST /auth/login (backend/src/modules/identity/auth.service.ts). */
interface LoginResponse {
  accessToken: string;
  user: { id: number; fullName: string; email: string; roleName: string };
}

/** Adapter gọi module `identity` của backend. */
export class HttpAuthRepository implements AuthRepository {
  async login({ username, password }: Credentials): Promise<AuthSession> {
    // BE nhận username hoặc email trong cùng field `identifier`.
    const { accessToken, user } = await apiPost<LoginResponse>('/auth/login', {
      identifier: username,
      password,
    });
    return {
      userId: String(user.id),
      displayName: user.fullName,
      email: user.email,
      token: accessToken,
      roleName: user.roleName,
    };
  }

  async requestPasswordReset(email: string): Promise<void> {
    await apiPost('/auth/forgot-password', { email });
  }

  async verifyResetCode(email: string, code: string): Promise<void> {
    await apiPost('/auth/verify-otp', { email, otp: code });
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await apiPost('/auth/reset-password', { email, otp: code, newPassword });
  }
}
