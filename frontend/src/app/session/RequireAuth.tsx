import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './SessionContext';

/** Gate for the authenticated app shell. Redirects to /login when there is no session. */
export function RequireAuth() {
  const { session } = useSession();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
