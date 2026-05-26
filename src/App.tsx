import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuthContext } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/layout/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { RoleSelection } from './components/ui/RoleSelection';
import PremiumLoader from './components/ui/PremiumLoader';

// Static page imports for instant, lag-free transitions
import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage';
import AttendancePage from './components/pages/AttendancePage';
import LeavesPage from './components/pages/LeavesPage';
import ReportsPage from './components/pages/ReportsPage';
import AnalyticsPage from './components/pages/AnalyticsPage';
import BotPage from './components/pages/BotPage';
import BrainstormPage from './components/pages/BrainstormPage';
import TeamManagementPage from './components/pages/TeamManagementPage';
import ChoppingBlockPage from './components/pages/ChoppingBlockPage';
import SettingsPage from './components/pages/SettingsPage';



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
    return <PremiumLoader />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PremiumLoader />}>
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
