import * as React from 'react';
import { ErrorInfo, ReactNode } from 'react';
import { Button } from '@heroui/react';

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
              <Button
                variant="danger"
                onPress={() => window.location.reload()}
              >
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
