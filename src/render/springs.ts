/** Motion transitions for the renderer, mirroring docs/DESIGN.md §3. Kept here
 *  so src/render does not depend on src/ui (WP-B); once src/ui/motion.ts lands
 *  these constants should be imported from there instead. */

import type { Transition } from 'motion/react';

export const springs = {
  /** Element travel: no overshoot. */
  move: { type: 'spring', stiffness: 520, damping: 42, mass: 1 } as const satisfies Transition,
  /** Pointers and carets. */
  settle: { type: 'spring', stiffness: 400, damping: 34 } as const satisfies Transition,
  /** Ask sheet, tick confirmation (slight overshoot). */
  sheet: { type: 'spring', stiffness: 300, damping: 26 } as const satisfies Transition,
  /** Opacity on enter/exit (DESIGN `s` = 180 ms). */
  fade: { duration: 0.18, ease: [0.2, 0.7, 0.2, 1] } as const satisfies Transition,
  /** Region x/width: an out-easing tween (DESIGN `m` = 260 ms), never a
   *  spring, because a spring could undershoot a width below zero. */
  region: { duration: 0.26, ease: [0.2, 0.7, 0.2, 1] } as const satisfies Transition,
  /** Colour changes of marks (DESIGN `xs` = 120 ms). */
  mark: { duration: 0.12 } as const satisfies Transition,
};

export type SpringKind = keyof typeof springs;

export const instant: Transition = { duration: 0 };
