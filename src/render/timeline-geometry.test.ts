import { describe, expect, it } from 'vitest';
import { askMarkHalf, kAtX, phaseRuns, tickStride, timelineX } from './timeline-geometry';

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

describe('tick thinning', () => {
  it('draws every tick when there is room', () => {
    expect(tickStride(13, 1000)).toBe(1);
  });
  it('thins ticks on a narrow strip to at least 6 px apart', () => {
    const s = tickStride(65, 358);
    expect([1, 2, 5, 10, 20, 50]).toContain(s);
    expect(((358 - 20) / 65) * s).toBeGreaterThanOrEqual(6);
    const seq = [1, 2, 5, 10, 20, 50];
    const prev = seq[seq.indexOf(s) - 1];
    if (prev !== undefined) expect(((358 - 20) / 65) * prev).toBeLessThan(6);
  });
  it('never exceeds the run length', () => {
    expect(tickStride(3, 20)).toBeLessThanOrEqual(3);
    expect(tickStride(0, 200)).toBe(1);
  });
  it('narrows ask marks only when asks crowd', () => {
    expect(askMarkHalf([2, 10], 13, 1000)).toBe(4);
    const half = askMarkHalf([10, 11, 12], 200, 358);
    expect(half).toBeGreaterThanOrEqual(1.5);
    expect(half).toBeLessThan(4);
  });
});
