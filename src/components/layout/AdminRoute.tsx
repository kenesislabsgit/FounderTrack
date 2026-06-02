import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';

/** Roles that have admin-level access to protected pages */
const ADMIN_ROLES: string[] = ['admin', 'founder'];

/**
 * Route guard that redirects non-admin/non-founder users to /dashboard.
 * Assumes it is nested inside a ProtectedRoute (user is already authenticated).
 * Renders child routes via <Outlet /> when user has admin or founder role.
 */
export function AdminRoute() {
  const { profile, loading } = useAuthContext();

  if (loading) {
    return null;
  }

  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
