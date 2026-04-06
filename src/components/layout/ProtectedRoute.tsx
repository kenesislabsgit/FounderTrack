import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';

/**
 * Route guard that redirects unauthenticated users to /login.
 * Renders child routes via <Outlet /> when authenticated.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuthContext();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
