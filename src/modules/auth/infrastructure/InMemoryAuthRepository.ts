import type { Credentials } from '../domain/credentials';
import type { AuthSession } from '../domain/session';
import { AuthError, type AuthRepository } from '../application/AuthRepository';

const LATENCY = 400;
const delay = () => new Promise<void>((r) => setTimeout(r, LATENCY));

/**
 * Mock adapter. Accepts any non-empty credentials and signs you in as "Han".
 * Reset codes are generated in-memory and logged to the console so the OTP
 * screen is testable without a mail server.
 *
 * ponytail: in-memory only, swap for an HTTP adapter behind AuthRepository when a backend exists.
 */
export class InMemoryAuthRepository implements AuthRepository {
  private codes = new Map<string, string>();

  async login({ username }: Credentials): Promise<AuthSession> {
    await delay();
    return {
      userId: 'u-001',
      displayName: username.trim() || 'Han',
      email: 'han@saigonbank.com.vn',
      token: `mock.${Date.now()}`,
    };
  }

  async requestPasswordReset(email: string): Promise<void> {
    await delay();
    const code = String(Math.floor(1000 + Math.random() * 9000));
    this.codes.set(email, code);
    // eslint-disable-next-line no-console
    console.info(`[IDSM mock] mã đặt lại mật khẩu cho ${email}: ${code}`);
  }

  async verifyResetCode(email: string, code: string): Promise<void> {
    await delay();
    if (this.codes.get(email) !== code) throw new AuthError('Mã xác thực không đúng');
  }

  async resetPassword(email: string): Promise<void> {
    await delay();
    this.codes.delete(email);
  }
}
