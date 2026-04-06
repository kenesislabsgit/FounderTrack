// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import type { ReactNode } from 'react';

/**
 * Feature: production-hosting-readiness, Property 7: Auth guard redirects unauthenticated users
 * **Validates: Requirements 9.5**
 *
 * For any protected URL path in the application's route configuration,
 * when no authenticated user is present, the ProtectedRoute component
 * SHALL redirect to the /login path.
 */

// Mock the AuthContext module
vi.mock('../contexts/AuthContext', () => ({
  useAuthContext: vi.fn(),
}));

// Import the mocked module so we can control its return value
import { useAuthContext } from '../contexts/AuthContext';
const mockedUseAuthContext = vi.mocked(useAuthContext);

// The protected paths in the application
const protectedPaths = [
  '/dashboard',
  '/attendance',
  '/leaves',
  '/reports',
  '/analytics',
  '/bot',
  '/brainstorm',
  '/team-management',
  '/chopping-block',
  '/settings',
];

// Arbitrary for selecting any protected path
const protectedPathArb = fc.constantFrom(...protectedPaths);

// Arbitrary for generating random sub-paths appended to protected paths
const protectedPathWithSubPath = protectedPathArb.chain((basePath) =>
  fc
    .array(
      fc.stringMatching(/^[a-z0-9-]+$/).filter((s) => s.length > 0 && s.length <= 10),
      { minLength: 0, maxLength: 2 },
    )
    .map((segments) =>
      segments.length > 0 ? `${basePath}/${segments.join('/')}` : basePath,
    ),
);

function renderWithRouter(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="*" element={<div data-testid="protected-content">Protected</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Feature: production-hosting-readiness, Property 7: Auth guard redirects unauthenticated users', () => {
  it('redirects unauthenticated users to /login for any protected path', () => {
    fc.assert(
      fc.property(protectedPathWithSubPath, (path) => {
        // Configure mock: no authenticated user, not loading
        mockedUseAuthContext.mockReturnValue({
          user: null,
          profile: null,
          loading: false,
          logout: vi.fn(),
          showRoleSelection: false,
          handleRoleSelect: vi.fn(),
          setProfile: vi.fn(),
        } as any);

        const { unmount } = renderWithRouter(path);

        // Should show login page (redirected)
        expect(screen.getByTestId('login-page')).toBeTruthy();
        // Should NOT show protected content
        expect(screen.queryByTestId('protected-content')).toBeNull();

        unmount();
      }),
      { numRuns: 100 },
    );
  });

  it('allows authenticated users to access any protected path', () => {
    fc.assert(
      fc.property(protectedPathArb, (path) => {
        // Configure mock: authenticated user
        mockedUseAuthContext.mockReturnValue({
          user: { uid: 'test-uid', email: 'test@example.com' },
          profile: { uid: 'test-uid', name: 'Test', email: 'test@example.com', role: 'employee' },
          loading: false,
          logout: vi.fn(),
          showRoleSelection: false,
          handleRoleSelect: vi.fn(),
          setProfile: vi.fn(),
        } as any);

        const { unmount } = renderWithRouter(path);

        // Should show protected content
        expect(screen.getByTestId('protected-content')).toBeTruthy();
        // Should NOT show login page
        expect(screen.queryByTestId('login-page')).toBeNull();

        unmount();
      }),
      { numRuns: 100 },
    );
  });
});
