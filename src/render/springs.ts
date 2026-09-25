/** Renderer transitions, built only from the motion tokens in src/ui/motion.ts
 *  (docs/DESIGN.md §3, §3a). No duration or spring constant is defined here.
 *
 *  Playback speed (0.5×–2×) scales every transition: tweens divide their
 *  duration; springs scale stiffness by speed² and damping by speed, which
 *  keeps the damping ratio (so `move` still never overshoots) and makes the
 *  motion exactly `speed` times faster. */

import type { Transition } from 'motion/react';
import { durations, easings, instant, springs as uiSprings } from '@/ui/motion';

export { instant };

export type RenderMotion =
  /** Element travel (bars, nodes): the `move` spring, no overshoot. */
  | 'move'
  /** Carets and frames: the `settle` spring. */
  | 'settle'
  /** Press-to-commit release and the correct settle: the `sheet` spring. */
  | 'sheet'
  /** Opacity on enter (s). */
  | 'fade'
  /** Mark colour changes (xs). */
  | 'mark'
  /** Region ruler: grows from its anchor edge (l, `out` easing). */
  | 'ruler'
  /** The lift arc of a picked-up element; as long as the move spring settles (m). */
  | 'lift'
  /** The correct ring drawing itself (m). */
  | 'draw'
  /** The ghost sketching in (m). */
  | 'sketch'
  /** The "your turn" breathing of pick targets: two cycles of l each way, then rest. */
  | 'pulse';

function scaledSpring(kind: keyof typeof uiSprings, speed: number): Transition {
  const s = uiSprings[kind];
  return { type: 'spring', stiffness: s.stiffness * speed * speed, damping: s.damping * speed, mass: s.mass };
}

function tween(ms: number, speed: number, ease: readonly number[] = easings.out): Transition {
  return { type: 'tween', duration: ms / 1000 / speed, ease: [...ease] as [number, number, number, number] };
}

/** The transition for one kind of change at a playback speed. */
export function renderTransition(kind: RenderMotion, speed = 1): Transition {
  const sp = speed > 0 ? speed : 1;
  switch (kind) {
    case 'move':
      return scaledSpring('move', sp);
    case 'settle':
      return scaledSpring('settle', sp);
    case 'sheet':
      return scaledSpring('sheet', sp);
    case 'fade':
      return tween(durations.s, sp);
    case 'mark':
      return tween(durations.xs, sp);
    case 'ruler':
      return tween(durations.l, sp);
    case 'lift':
      return { ...tween(durations.m, sp, easings.inOut), times: [0, 0.5, 1] };
    case 'draw':
      return tween(durations.m, sp);
    case 'sketch':
      return tween(durations.m, sp);
    case 'pulse':
      return tween(durations.l * 4, 1, easings.inOut);
  }
}

/** Kept for callers of the WP-A API: the renderer's named transitions at 1×. */
export type SpringKind = RenderMotion;
