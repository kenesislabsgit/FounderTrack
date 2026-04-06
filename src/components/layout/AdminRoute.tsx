import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';

/**
 * Route guard that redirects non-admin users to /dashboard.
 * Assumes it is nested inside a ProtectedRoute (user is already authenticated).
 * Renders child routes via <Outlet /> when user has admin role.
 */
export function AdminRoute() {
  const { profile, loading } = useAuthContext();

  if (loading) {
    return null;
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
