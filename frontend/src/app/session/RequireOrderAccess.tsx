import { Navigate, Outlet } from 'react-router-dom';
import { canAccessOrders } from '@/modules/auth/domain/session';
import { useSession } from './SessionContext';

/** Chỉ Quản trị viên hoặc Trưởng phòng Kỹ thuật vào được; role khác về /dashboard. */
export function RequireOrderAccess() {
  const { session } = useSession();
  return canAccessOrders(session) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
