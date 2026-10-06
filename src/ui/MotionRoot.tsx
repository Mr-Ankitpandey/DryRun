/** The app's one `LazyMotion` (DESIGN §3a: Motion's reduced bundle). Every
 *  animated component in src/ui, src/render and src/app uses the `m`
 *  components from 'motion/react-m'; this root supplies their features.
 *
 *  The features (`domAnimation`) are fetched on the first sign of a person
 *  (pointer, touch or key), not with the page: nothing moves before someone
 *  acts, and a page that is only looked at never downloads them.
 *
 *  Until they arrive an `m` component cannot animate, so an element that
 *  mounts with `initial={{ opacity: 0 }}` would stay invisible. `useMotionReady`
 *  tells components whether they can play an enter animation; before that
 *  they mount in their final state. */

import { LazyMotion } from 'motion/react';
import type { domAnimation } from 'motion/react';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

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

type Features = typeof domAnimation;
let loaded: Promise<Features> | null = null;
let ready = false;

/** Resolves with the features once someone has interacted (memoised). */
export function loadMotionFeatures(): Promise<Features> {
  loaded ??= firstInteraction()
    .then(() => import('./motion-features'))
    .then((r) => {
      ready = true;
      return r.default;
    });
  return loaded;
}

const ReadyContext = createContext(false);

export function MotionRoot({ children }: { children: ReactNode }) {
  const [isReady, setReady] = useState(ready);
  // LazyMotion calls this once, from an effect.
  const [features] = useState(() => () =>
    loadMotionFeatures().then((f) => {
      setReady(true);
      return f;
    }),
  );
  return (
    <LazyMotion features={features}>
      <ReadyContext.Provider value={isReady}>{children}</ReadyContext.Provider>
    </LazyMotion>
  );
}

/** False until Motion's features have loaded: an enter animation mounted
 *  before then could not play, so components skip it (`initial={false}`). */
export function useMotionReady(): boolean {
  return useContext(ReadyContext);
}
