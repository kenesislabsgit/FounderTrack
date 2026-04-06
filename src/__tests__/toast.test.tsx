// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from '../components/ui/ToastProvider';
import type { ReactNode } from 'react';

// Mock motion/react to avoid animation issues in tests
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => {
      // Filter out motion-specific props
      const {
        layout: _layout,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        ...htmlProps
      } = props;
      return <div {...htmlProps}>{children}</div>;
    },
  },
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('Toast System', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('useToast throws when used outside ToastProvider', () => {
    expect(() => {
      renderHook(() => useToast());
    }).toThrow('useToast must be used within a ToastProvider');
  });

  it('addToast renders a toast with the correct message', () => {
    function TestComponent() {
      const { addToast } = useToast();
      return (
        <button onClick={() => addToast('Test message', 'info')}>
          Show Toast
        </button>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('Show Toast').click();
    });

    expect(screen.getByText('Test message')).toBeTruthy();
  });

  it('renders correct variant via data-variant attribute', () => {
    function TestComponent() {
      const { addToast } = useToast();
      return (
        <>
          <button onClick={() => addToast('Error!', 'error')}>Error</button>
          <button onClick={() => addToast('Success!', 'success')}>
            Success
          </button>
        </>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('Error').click();
    });

    const errorAlert = screen.getByText('Error!').closest('[role="alert"]');
    expect(errorAlert?.getAttribute('data-variant')).toBe('error');

    act(() => {
      screen.getByText('Success').click();
    });

    const successAlert = screen.getByText('Success!').closest('[role="alert"]');
    expect(successAlert?.getAttribute('data-variant')).toBe('success');
  });

  it('auto-dismisses after the specified duration', async () => {
    function TestComponent() {
      const { addToast } = useToast();
      return (
        <button onClick={() => addToast('Bye soon', 'info', 2000)}>
          Show
        </button>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('Show').click();
    });

    expect(screen.getByText('Bye soon')).toBeTruthy();

    // Advance past the 2000ms duration
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.queryByText('Bye soon')).toBeNull();
  });

  it('uses default 4s duration when none specified', async () => {
    function TestComponent() {
      const { addToast } = useToast();
      return (
        <button onClick={() => addToast('Default duration')}>Show</button>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('Show').click();
    });

    expect(screen.getByText('Default duration')).toBeTruthy();

    // Still visible at 3.9s
    act(() => {
      vi.advanceTimersByTime(3900);
    });
    expect(screen.queryByText('Default duration')).toBeTruthy();

    // Gone after 4s
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Default duration')).toBeNull();
  });

  it('supports multiple toasts simultaneously', () => {
    function TestComponent() {
      const { addToast } = useToast();
      return (
        <button
          onClick={() => {
            addToast('First', 'info');
            addToast('Second', 'warning');
            addToast('Third', 'error');
          }}
        >
          Show All
        </button>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('Show All').click();
    });

    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.getByText('Third')).toBeTruthy();
  });
});
