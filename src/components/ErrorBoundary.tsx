import * as React from 'react';
import { ErrorInfo, ReactNode } from 'react';


interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--bg-primary))] p-4">
          <div className="max-w-md glass-elevated rounded-2xl">
            <div className="flex flex-col items-start gap-1 pb-2 p-6">
              <h1 className="text-xl font-bold text-[hsl(var(--danger))]">
                Something went wrong
              </h1>
            </div>
            <div className="py-2 px-6">
              <p className="text-sm text-[hsl(var(--text-secondary))]">
                {this.state.error?.message || 'An unexpected error occurred.'}
              </p>
            </div>
            <div className="pt-2 p-6">
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-gradient-to-b from-[hsl(0,72%,58%)] to-[hsl(0,72%,48%)] px-5 py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_0_hsla(0,80%,75%,0.35),0_2px_4px_rgba(0,0,0,0.25)] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
