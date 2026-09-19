import { Navigate, Outlet } from 'react-router-dom';
import { isAdmin } from '@/modules/auth/domain/session';
import { useSession } from './SessionContext';

/** Chỉ Quản trị viên vào được; role khác về /dashboard. Đặt bên trong <RequireAuth/>. */
export function RequireAdmin() {
  const { session } = useSession();
  return isAdmin(session) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
