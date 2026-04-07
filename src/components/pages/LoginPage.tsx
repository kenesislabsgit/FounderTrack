import { Navigate } from 'react-router-dom';
import { Button, Spinner } from '@heroui/react';
import { useAuthContext } from '../../contexts/AuthContext';

export default function LoginPage() {
  const { user, login, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(var(--bg-primary))]">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-[hsl(var(--text-muted))]">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[hsl(var(--bg-primary))] p-4">
      <div className="w-full max-w-md space-y-8 text-center animate-slide-up-fade">
        <div className="flex justify-center gap-3 items-center">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] flex items-center justify-center font-bold text-2xl text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)] animate-glow-pulse">K</div>
          <h1 className="text-4xl font-black tracking-tighter text-[hsl(var(--text-primary))] uppercase">Kenesis <span className="text-[hsl(var(--accent))]">Vision</span></h1>
        </div>
        <div className="glass-elevated rounded-2xl p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Worker Tracking System</h2>
            <p className="text-[hsl(var(--text-muted))]">Secure workspace monitoring for Founders, Interns, and Employees.</p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onPress={login}
            className="w-full gap-3"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="h-6 w-6" />
            Sign in with Google
          </Button>
        </div>
        <p className="text-[10px] text-[hsl(var(--text-muted))] uppercase tracking-[0.2em] font-bold">Authorized Access Only</p>
      </div>
    </div>
  );
}
