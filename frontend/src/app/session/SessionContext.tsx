import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { isTokenExpired, type AuthSession } from '@/modules/auth/domain/session';
import { configureApiSession } from '@/shared/lib/apiClient';

const STORAGE_KEY = 'idsm.session';
export const SESSION_EXPIRED_NOTICE = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';

interface SessionContextValue {
  session: AuthSession | null;
  /** Thông báo cho màn đăng nhập (vd. hết phiên). Xoá khi đăng nhập lại. */
  notice: string | null;
  signIn: (session: AuthSession) => void;
  signOut: (reason?: 'expired') => void;
}

interface SessionState {
  session: AuthSession | null;
  notice: string | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function writeStored(session: AuthSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — session stays in memory only */
  }
}

function readInitial(): SessionState {
  let stored: AuthSession | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    stored = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    stored = null;
  }
  // Hàm thuần (StrictMode gọi initializer 2 lần) — việc xoá storage cũ làm trong useEffect.
  if (!stored) return { session: null, notice: null };
  // Phiên lưu từ bản cũ (chưa có roleName / departmentCode) — bỏ, bắt đăng nhập lại.
  // departmentCode so với `undefined` chứ KHÔNG kiểm falsy: null là giá trị hợp lệ
  // (user không thuộc phòng ban nào, vd. Quản trị viên) — kiểm falsy sẽ đá văng họ mỗi lần mở app.
  if (!stored.roleName || stored.departmentCode === undefined) {
    return { session: null, notice: null };
  }
  if (isTokenExpired(stored.token)) return { session: null, notice: SESSION_EXPIRED_NOTICE };
  return { session: stored, notice: null };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(readInitial);

  // Phiên lưu trong storage không hợp lệ / hết hạn lúc mở app → xoá hẳn.
  useEffect(() => {
    if (!state.session) writeStored(null);
  }, [state.session]);

  const signIn = useCallback((session: AuthSession) => {
    setState({ session, notice: null });
    writeStored(session);
  }, []);

  const signOut = useCallback((reason?: 'expired') => {
    setState({ session: null, notice: reason === 'expired' ? SESSION_EXPIRED_NOTICE : null });
    writeStored(null);
  }, []);

  // Cấu hình ngay trong render (không đợi useEffect): effect của page con chạy TRƯỚC effect của
  // provider, nên request đầu tiên của page phải thấy token ngay. Lệnh này idempotent.
  const token = state.session?.token ?? null;
  configureApiSession({ getToken: () => token, onUnauthorized: () => signOut('expired') });

  const value = useMemo<SessionContextValue>(
    () => ({ session: state.session, notice: state.notice, signIn, signOut }),
    [state, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
