/** Zero-duration mode (docs/ARCHITECTURE.md §5): while the timeline is being
 *  scrubbed or the user prefers reduced motion, every transition is instant.
 *  State is exact, so there is nothing to catch up on. */

import { useReducedMotion } from 'motion/react';
import type { Transition } from 'motion/react';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { SpringKind } from './springs';
import { instant, springs } from './springs';

const InstantContext = createContext(false);

export function MotionModeProvider({ scrubbing = false, reduced = false, children }: { scrubbing?: boolean; reduced?: boolean; children: ReactNode }) {
  const prefersReduced = useReducedMotion() ?? false;
  return <InstantContext.Provider value={scrubbing || reduced || prefersReduced}>{children}</InstantContext.Provider>;
}

export function useInstant(): boolean {
  return useContext(InstantContext);
}

/** The transition for a kind of change, or `{ duration: 0 }` in instant mode. */
export function useTransition(kind: SpringKind): Transition {
  const inst = useContext(InstantContext);
  return inst ? instant : springs[kind];
}
