/** An authenticated user session. Produced by the login use-case, consumed app-wide. */
export interface AuthSession {
  userId: string;
  displayName: string;
  email: string;
  token: string;
}
