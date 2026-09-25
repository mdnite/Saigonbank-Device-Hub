import { Navigate, Outlet } from 'react-router-dom';
import { canAccessTransfers } from '@/modules/auth/domain/session';
import { useSession } from './SessionContext';

/** Chỉ Quản trị viên hoặc Trưởng phòng Kỹ thuật vào được; role khác về /dashboard. */
export function RequireTransferAccess() {
  const { session } = useSession();
  return canAccessTransfers(session) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
