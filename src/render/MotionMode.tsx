/** Motion context for everything under the stage (docs/ARCHITECTURE.md §5,
 *  docs/DESIGN.md §3a):
 *  - Motion's reduced bundle: `LazyMotion` with the `domAnimation` features
 *    loaded asynchronously (./motion-features); render and trace code use the
 *    `m` components from 'motion/react-m' only.
 *  - Zero-duration mode: while the timeline is scrubbed, or when the OS or the
 *    stored setting asks for reduced motion, every transition is instant.
 *    State is exact, so there is nothing to catch up on.
 *  - Playback speed scales every transition.
 *  - Move hints for the step being shown (arc over / under / flat). */

import { LazyMotion } from 'motion/react';
import type { Transition } from 'motion/react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMotionPref } from '@/ui/motion';
import type { Lift, MoveHints } from './motion-hints';
import { NO_HINTS } from './motion-hints';
import type { RenderMotion } from './springs';
import { instant, renderTransition } from './springs';

/** Motion's animation features are fetched on the first sign of a person
 *  (pointer, touch or key), not with the page: a trace never moves before
 *  someone acts, and a page that is only looked at never pays for them. */
const WAKE_EVENTS = ['pointerdown', 'pointermove', 'touchstart', 'keydown'] as const;
let awake = false;
let waking: Promise<void> | null = null;
function firstInteraction(): Promise<void> {
  if (awake || typeof window === 'undefined') return Promise.resolve();
  waking ??= new Promise<void>((resolve) => {
    const wake = () => {
      awake = true;
      for (const ev of WAKE_EVENTS) window.removeEventListener(ev, wake, true);
      resolve();
    };
    for (const ev of WAKE_EVENTS) window.addEventListener(ev, wake, { capture: true, passive: true });
  });
  return waking;
}
const loadFeatures = () =>
  firstInteraction()
    .then(() => import('./motion-features'))
    .then((r) => r.default);

interface MotionMode {
  instant: boolean;
  speed: number;
  /** False during the first render: what is on screen when a page opens
   *  never fades in (and cannot wait for the animation features). */
  appeared: boolean;
}

const MotionModeContext = createContext<MotionMode>({ instant: false, speed: 1, appeared: true });
/** Separate from the mode so that per-step hints only re-render the views that
 *  read them (they pass each element its own hint as a prop). */
const HintsContext = createContext<MoveHints>(NO_HINTS);

export interface MotionModeProviderProps {
  /** True while the timeline is being dragged. */
  scrubbing?: boolean;
  /** Force instant transitions (stills, tests). The OS/setting preference is always honoured too. */
  reduced?: boolean;
  speed?: number;
  hints?: MoveHints;
  children: ReactNode;
}

export function MotionModeProvider({ scrubbing = false, reduced = false, speed = 1, hints = NO_HINTS, children }: MotionModeProviderProps) {
  const pref = useMotionPref();
  const isInstant = scrubbing || reduced || pref.reduced;
  const [appeared, setAppeared] = useState(false);
  // One re-render after mount flips `appeared`; it is read only when a
  // component mounts (its `initial`), so nothing else depends on it.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setAppeared(true), []);
  const value = useMemo(() => ({ instant: isInstant, speed, appeared }), [isInstant, speed, appeared]);
  return (
    <LazyMotion features={loadFeatures}>
      <MotionModeContext.Provider value={value}>
        <HintsContext.Provider value={hints}>{children}</HintsContext.Provider>
      </MotionModeContext.Provider>
    </LazyMotion>
  );
}

export function useInstant(): boolean {
  return useContext(MotionModeContext).instant;
}

/** Whether a component mounting now should skip its enter animation: in
 *  instant mode, and for everything present when the stage first renders. */
export function useEnterInstant(): boolean {
  const { instant: inst, appeared } = useContext(MotionModeContext);
  return inst || !appeared;
}

export function useSpeed(): number {
  return useContext(MotionModeContext).speed;
}

/** The transition for a kind of change, or `{ duration: 0 }` in instant mode. */
export function useTransition(kind: RenderMotion): Transition {
  const { instant: inst, speed } = useContext(MotionModeContext);
  return inst ? instant : renderTransition(kind, speed);
}

/** How elements travel in the current step (views read this and pass each
 *  element its own `lift`). */
export function useMoveHints(): MoveHints {
  return useContext(HintsContext);
}

export type { Lift };
