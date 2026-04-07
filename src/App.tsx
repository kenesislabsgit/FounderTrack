import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuthContext } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/layout/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { RoleSelection } from './components/ui/RoleSelection';

// Lazy-loaded page components
const LoginPage = lazy(() => import('./components/pages/LoginPage'));
const DashboardPage = lazy(() => import('./components/pages/DashboardPage'));
const AttendancePage = lazy(() => import('./components/pages/AttendancePage'));
const LeavesPage = lazy(() => import('./components/pages/LeavesPage'));
const ReportsPage = lazy(() => import('./components/pages/ReportsPage'));
const AnalyticsPage = lazy(() => import('./components/pages/AnalyticsPage'));
const BotPage = lazy(() => import('./components/pages/BotPage'));
const BrainstormPage = lazy(() => import('./components/pages/BrainstormPage'));
const TeamManagementPage = lazy(() => import('./components/pages/TeamManagementPage'));
const ChoppingBlockPage = lazy(() => import('./components/pages/ChoppingBlockPage'));
const SettingsPage = lazy(() => import('./components/pages/SettingsPage'));

function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-[hsl(var(--bg-primary))]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[hsl(var(--accent))] border-t-transparent" />
        <p className="text-sm font-medium text-[hsl(var(--text-muted))]">Kenesis Vision Loading...</p>
      </div>
    </div>
  );
}

/**
 * Layout shell wrapping all authenticated pages.
 * Renders the sidebar + main content area with an <Outlet /> equivalent via children.
 */
function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, logout, showRoleSelection, handleRoleSelect } = useAuthContext();

  if (showRoleSelection) {
    return <RoleSelection onSelect={handleRoleSelect} />;
  }

  return (
    <div className="flex h-screen bg-[hsl(var(--bg-primary))] text-[hsl(var(--text-primary))] overflow-hidden">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar user={user} profile={profile} onLogout={logout} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { loading } = useAuthContext();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes — require authentication */}
          <Route element={<ProtectedRoute />}>
            {/* Routes wrapped in the app layout shell */}
            <Route
              path="/dashboard"
              element={<AppLayout><DashboardPage /></AppLayout>}
            />
            <Route
              path="/attendance"
              element={<AppLayout><AttendancePage /></AppLayout>}
            />
            <Route
              path="/leaves"
              element={<AppLayout><LeavesPage /></AppLayout>}
            />
            <Route
              path="/reports"
              element={<AppLayout><ReportsPage /></AppLayout>}
            />
            <Route
              path="/brainstorm"
              element={<AppLayout><BrainstormPage /></AppLayout>}
            />
            <Route
              path="/settings"
              element={<AppLayout><SettingsPage /></AppLayout>}
            />

            {/* Admin-only routes */}
            <Route element={<AdminRoute />}>
              <Route
                path="/analytics"
                element={<AppLayout><AnalyticsPage /></AppLayout>}
              />
              <Route
                path="/bot"
                element={<AppLayout><BotPage /></AppLayout>}
              />
              <Route
                path="/team-management"
                element={<AppLayout><TeamManagementPage /></AppLayout>}
              />
              <Route
                path="/chopping-block"
                element={<AppLayout><ChoppingBlockPage /></AppLayout>}
              />
            </Route>

            {/* Catch-all: redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>

          {/* Unauthenticated catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
