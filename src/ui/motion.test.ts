import { describe, expect, it } from 'vitest';
import { durations, easings, springs, transitionFor } from './motion';

describe('motion spec', () => {
  it('matches DESIGN §3 durations and springs', () => {
    expect(durations).toEqual({ xs: 120, s: 180, m: 260, l: 380, xl: 560 });
    expect(springs.move).toMatchObject({ type: 'spring', stiffness: 520, damping: 42, mass: 1 });
    expect(springs.settle).toMatchObject({ type: 'spring', stiffness: 400, damping: 34 });
    expect(springs.sheet).toMatchObject({ type: 'spring', stiffness: 300, damping: 26 });
    expect(easings.out).toEqual([0.2, 0.7, 0.2, 1]);
    expect(easings.inOut).toEqual([0.6, 0, 0.2, 1]);
  });

  it('returns springs by name', () => {
    expect(transitionFor('move')).toEqual(springs.move);
    expect(transitionFor('sheet', { delay: 100 })).toEqual({ ...springs.sheet, delay: 0.1 });
  });

  it('returns tweens in seconds, scaled by speed', () => {
    expect(transitionFor('m')).toEqual({ type: 'tween', duration: 0.26, ease: [0.2, 0.7, 0.2, 1] });
    expect(transitionFor('l', { speed: 2 })).toMatchObject({ duration: 0.19 });
    expect(transitionFor('xs', { speed: 0 })).toMatchObject({ duration: 0.12 });
  });

  it('snaps when instant', () => {
    expect(transitionFor('move', { instant: true })).toEqual({ duration: 0 });
    expect(transitionFor('xl', { instant: true, delay: 500 })).toEqual({ duration: 0 });
  });
});
