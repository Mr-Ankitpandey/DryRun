import { describe, expect, it } from 'vitest';
import { kAtX, phaseRuns, timelineX } from './timeline-geometry';

describe('timeline geometry', () => {
  it('maps k to x and back', () => {
    expect(timelineX(0, 10, 220, 10)).toBe(10);
    expect(timelineX(10, 10, 220, 10)).toBe(210);
    expect(timelineX(5, 10, 220, 10)).toBe(110);
    for (let k = 0; k <= 10; k++) expect(kAtX(timelineX(k, 10, 220, 10), 10, 220, 10)).toBe(k);
  });
  it('clamps pointers outside the strip', () => {
    expect(kAtX(-50, 10, 220, 10)).toBe(0);
    expect(kAtX(900, 10, 220, 10)).toBe(10);
  });
  it('handles an empty run', () => {
    expect(timelineX(0, 0, 200)).toBe(10);
    expect(kAtX(100, 0, 200)).toBe(0);
  });
  it('groups phases into runs; unlabelled steps join the previous run', () => {
    const runs = phaseRuns(['setup', 'loop', undefined, 'loop', 'done', 'loop']);
    expect(runs.map((r) => [r.phase, r.from, r.to, r.index])).toEqual([
      ['setup', 0, 1, 0],
      ['loop', 1, 4, 1],
      ['done', 4, 5, 2],
      ['loop', 5, 6, 1],
    ]);
  });
});
