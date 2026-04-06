import { createContext, useContext, ReactNode } from 'react';
import { useAuth as useAuthHook, UseAuthReturn } from '../hooks/useAuth';

const AuthContext = createContext<UseAuthReturn | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthHook();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/**
 * Consume the shared auth context.
 * Must be used inside an <AuthProvider>.
 */
export function useAuthContext(): UseAuthReturn {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
