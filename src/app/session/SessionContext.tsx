import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthSession } from '@/modules/auth/domain/session';

const STORAGE_KEY = 'idsm.session';

interface SessionContextValue {
  session: AuthSession | null;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function readStored(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(readStored);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      signIn: (s) => {
        setSession(s);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        } catch {
          /* storage unavailable — session stays in memory only */
        }
      },
      signOut: () => {
        setSession(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
      },
    }),
    [session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
