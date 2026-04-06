/**
 * Property 10: StatusDot maps session state to correct visual
 *
 * For any valid SessionState ('active' | 'on-break' | 'away' | 'offline'),
 * the StatusDot component SHALL render with the correct color class and
 * SHALL include a pulse animation if and only if the state is 'active'.
 *
 * **Validates: Requirements 17 (criteria 43-47)**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { SessionState } from '../types';
import { stateStyles } from '../components/ui/StatusDot';

const allStates: SessionState[] = ['active', 'on-break', 'away', 'offline'];

const sessionStateArb = fc.constantFrom<SessionState>(...allStates);

/** Expected color class substrings per state */
const expectedColorMap: Record<SessionState, string> = {
  active: '--state-active)',
  'on-break': '--state-break)',
  away: '--state-away)',
  offline: '--state-offline)',
};

describe('Feature: production-hosting-readiness, Property 10: StatusDot visual mapping', () => {
  it('maps every SessionState to the correct color class', () => {
    fc.assert(
      fc.property(sessionStateArb, (state) => {
        const style = stateStyles[state];
        expect(style).toBeDefined();
        expect(style.dot).toContain(expectedColorMap[state]);
      }),
      { numRuns: 100 },
    );
  });

  it('enables pulse animation if and only if state is "active"', () => {
    fc.assert(
      fc.property(sessionStateArb, (state) => {
        const style = stateStyles[state];
        if (state === 'active') {
          expect(style.pulse).toBe(true);
        } else {
          expect(style.pulse).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('covers all four session states in the stateStyles map', () => {
    for (const state of allStates) {
      expect(stateStyles[state]).toBeDefined();
      expect(typeof stateStyles[state].dot).toBe('string');
      expect(typeof stateStyles[state].pulse).toBe('boolean');
    }
  });
});
