import { Navigate, Outlet } from 'react-router-dom';
import type { AuthSession } from '@/modules/auth/domain/session';
import { useSession } from './SessionContext';

/** Route guard theo quyền: `can(session)` sai thì chuyển về `to`. Đặt bên trong <RequireAuth/>. */
export function RequireCan({
  can,
  to = '/dashboard',
}: {
  can: (session: AuthSession | null) => boolean;
  to?: string;
}) {
  const { session } = useSession();
  return can(session) ? <Outlet /> : <Navigate to={to} replace />;
}
