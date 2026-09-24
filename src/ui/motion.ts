/** Motion spec as code (docs/DESIGN.md §3). Mirrors the --dur-* / --ease-* custom
 *  properties in src/styles/tokens.css. Components never hard-code a duration:
 *  they ask `transitionFor(kind)` and pass the result to Motion. */

import { useSyncExternalStore } from 'react';
import type { Transition } from 'motion/react';
import { useTheme } from './theme';

/** Durations in milliseconds. */
export const durations = {
  xs: 120,
  s: 180,
  m: 260,
  l: 380,
  xl: 560,
} as const;

export type DurationKey = keyof typeof durations;

/** Springs (Motion `type: 'spring'`). `move` and `settle` do not overshoot;
 *  `sheet` has a hint of overshoot for the ask sheet and the correct tick. */
export const springs = {
  move: { type: 'spring', stiffness: 520, damping: 42, mass: 1 },
  settle: { type: 'spring', stiffness: 400, damping: 34, mass: 1 },
  sheet: { type: 'spring', stiffness: 300, damping: 26, mass: 1 },
} as const satisfies Record<string, Transition>;

export type SpringKey = keyof typeof springs;

/** Easings for non-spring (tween) transitions, as cubic-bezier tuples. */
export const easings = {
  out: [0.2, 0.7, 0.2, 1],
  inOut: [0.6, 0, 0.2, 1],
} as const;

/** CSS strings of the same easings, for inline styles that cannot use tokens. */
export const easingCss = {
  out: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  inOut: 'cubic-bezier(0.6, 0, 0.2, 1)',
} as const;

export type MotionKind = SpringKey | DurationKey;

export interface TransitionOptions {
  /** Return a zero-duration transition (scrubbing, reduced motion). */
  instant?: boolean;
  /** Playback speed multiplier (0.5×, 1×, 1.5×, 2×). Only affects tweens. */
  speed?: number;
  /** Delay in ms. Ignored when instant. */
  delay?: number;
}

export const instant: Transition = { duration: 0 };

/** Builds a Motion transition for a spring or a named duration. Durations use
 *  the `out` easing; pass `instant: true` to snap. */
export function transitionFor(kind: MotionKind, opts: TransitionOptions = {}): Transition {
  if (opts.instant) return instant;
  const delay = opts.delay ? { delay: opts.delay / 1000 } : {};
  if (kind in springs) {
    return { ...springs[kind as SpringKey], ...delay };
  }
  const speed = opts.speed && opts.speed > 0 ? opts.speed : 1;
  return {
    type: 'tween',
    duration: durations[kind as DurationKey] / 1000 / speed,
    ease: [...easings.out],
    ...delay,
  };
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function readReduced(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_QUERY).matches;
}

/** True when the OS asks for reduced motion. */
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, readReduced, () => false);
}

export interface MotionPref {
  /** Reduced when either the OS media query or the stored setting says so. */
  reduced: boolean;
  /** Which source asked for it (for the settings screen and the styleguide). */
  source: 'none' | 'system' | 'setting' | 'both';
}

/** Combines `prefers-reduced-motion` with the stored `motion: 'reduced'` setting. */
export function useMotionPref(): MotionPref {
  const system = useSystemReducedMotion();
  const { motion } = useTheme();
  const setting = motion === 'reduced';
  const source = system && setting ? 'both' : system ? 'system' : setting ? 'setting' : 'none';
  return { reduced: system || setting, source };
}

/** Convenience: a transition that already honours the motion preference. */
export function useTransition(kind: MotionKind, opts: Omit<TransitionOptions, 'instant'> = {}): Transition {
  const { reduced } = useMotionPref();
  return transitionFor(kind, { ...opts, instant: reduced });
}
