import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';

export default function LoginPage() {
  const { user, login, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(var(--bg-primary))]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[hsl(var(--accent))] border-t-transparent" />
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
          <button
            onClick={login}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] px-6 py-4 text-lg font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)]"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="h-6 w-6" />
            Sign in with Google
          </button>
        </div>
        <p className="text-[10px] text-[hsl(var(--text-muted))] uppercase tracking-[0.2em] font-bold">Authorized Access Only</p>
      </div>
    </div>
  );
}
