// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme';

describe('useTheme', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('defaults to dark when no stored preference and no OS preference', () => {
    // Mock matchMedia to return false for light preference
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('reads stored theme from localStorage', () => {
    localStorage.setItem('theme', 'light');

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists theme to localStorage on setTheme', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(localStorage.getItem('theme')).toBe('light');
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggleTheme switches between dark and light', () => {
    localStorage.setItem('theme', 'dark');

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('falls back to OS preference when no stored theme', () => {
    // Mock OS preference for light mode
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('sets data-theme attribute on document element', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => {
      result.current.setTheme('dark');
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
