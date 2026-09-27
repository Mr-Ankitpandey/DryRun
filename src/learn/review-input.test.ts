import { describe, expect, it } from 'vitest';
import type { Rng } from '@/lib/rng';
import { createRng } from '@/lib/rng';
import type { MistakeRecord } from '@/lib/storage';
import { parseQuery } from '@/lib/url';
import type { MistakeKind } from '@/trace/asks';
import { practiceUrl, reviewInput, weakestKind } from './review-input';
import { DAY_MS, reviewSeed } from './scheduler';

const NOW = Date.UTC(2026, 8, 27, 12, 0, 0);

let n = 0;
function mistake(algorithm: string, kind: MistakeKind, daysAgo: number): MistakeRecord {
  n += 1;
  return { id: `m${n}`, algorithm, kind, rule: 'r', seed: 's', input: 'i=1', askIndex: 0, at: NOW - daysAgo * DAY_MS };
}

/** A stand-in module that records the target it was asked for and the first rng draw. */
function fakeModule() {
  const calls: { target: string | undefined; argc: number; draw: number }[] = [];
  return {
    calls,
    randomInput(rng: Rng, ...rest: [string?]) {
      const draw = rng.next();
      calls.push({ target: rest[0], argc: 1 + rest.length, draw });
      return { a: [Math.floor(draw * 100)], t: rest[0] ?? null };
    },
    encode(input: { a: number[]; t: string | null }) {
      return { i: input.a.join(','), t: input.t ?? 'none' };
    },
  };
}

describe('weakestKind', () => {
  it('is null with no mistakes for the algorithm', () => {
    expect(weakestKind([], 'dijkstra', NOW)).toBeNull();
    expect(weakestKind([mistake('bst', 'subtree', 1)], 'dijkstra', NOW)).toBeNull();
  });

  it('picks the most frequent kind in the window', () => {
    const ms = [mistake('dijkstra', 'order', 1), mistake('dijkstra', 'stale', 2), mistake('dijkstra', 'stale', 5), mistake('bst', 'subtree', 1), mistake('bst', 'subtree', 1)];
    expect(weakestKind(ms, 'dijkstra', NOW)).toBe('stale');
  });

  it('ignores mistakes older than the window (default 30 days)', () => {
    const ms = [mistake('dijkstra', 'stale', 31), mistake('dijkstra', 'stale', 40), mistake('dijkstra', 'order', 29)];
    expect(weakestKind(ms, 'dijkstra', NOW)).toBe('order');
    expect(weakestKind(ms, 'dijkstra', NOW, 60)).toBe('stale');
    expect(weakestKind([mistake('dijkstra', 'stale', 31)], 'dijkstra', NOW)).toBeNull();
  });

  it('breaks a tie by the most recent occurrence', () => {
    const ms = [mistake('bfs', 'order', 10), mistake('bfs', 'boundary', 3), mistake('bfs', 'order', 12), mistake('bfs', 'boundary', 20)];
    expect(weakestKind(ms, 'bfs', NOW)).toBe('boundary');
    expect(weakestKind([...ms, mistake('bfs', 'order', 1)], 'bfs', NOW)).toBe('order');
  });

  it('a filter narrows the kinds considered', () => {
    const ms = [mistake('dijkstra', 'unclassified', 1), mistake('dijkstra', 'unclassified', 2), mistake('dijkstra', 'order', 3)];
    expect(weakestKind(ms, 'dijkstra', NOW)).toBe('unclassified');
    expect(weakestKind(ms, 'dijkstra', NOW, 30, (k) => k !== 'unclassified')).toBe('order');
  });

  it('does not depend on record order', () => {
    const ms = [mistake('knapsack', 'comparison', 4), mistake('knapsack', 'dependency', 4), mistake('knapsack', 'comparison', 6), mistake('knapsack', 'dependency', 6)];
    // Equal counts and equal latest times: kind id decides, whatever the order.
    expect(weakestKind(ms, 'knapsack', NOW)).toBe('comparison');
    expect(weakestKind([...ms].reverse(), 'knapsack', NOW)).toBe('comparison');
  });
});

describe('reviewInput', () => {
  it('without mistakes is exactly the untargeted review input (same seed, same draw, no target argument)', () => {
    const m = fakeModule();
    const r = reviewInput(m, 'dijkstra', { reviews: 2 }, [], NOW);
    expect(r.seed).toBe(reviewSeed('dijkstra', 2));
    expect(r.target).toBeNull();
    expect(m.calls).toEqual([{ target: undefined, argc: 1, draw: createRng(reviewSeed('dijkstra', 2)).next() }]);
    expect(r.input).toEqual({ a: [Math.floor(createRng(r.seed).next() * 100)], t: null });
  });

  it('targets the weakest kind with the mapped randomInput target', () => {
    const m = fakeModule();
    const ms = [mistake('dijkstra', 'stale', 1), mistake('dijkstra', 'stale', 2), mistake('dijkstra', 'order', 1)];
    const r = reviewInput(m, 'dijkstra', { reviews: 3 }, ms, NOW);
    expect(r.target).toBe('stale');
    expect(r.seed).toBe(reviewSeed('dijkstra', 3));
    expect(m.calls[0]?.target).toBe('stale');
    expect(m.calls[0]?.draw).toBe(createRng(reviewSeed('dijkstra', 3)).next());
  });

  it('passes over kinds with no target (unclassified) to the next weakest one', () => {
    const m = fakeModule();
    const ms = [mistake('bst', 'unclassified', 1), mistake('bst', 'unclassified', 1), mistake('bst', 'unclassified', 1), mistake('bst', 'subtree', 2)];
    const r = reviewInput(m, 'bst', { reviews: 0 }, ms, NOW);
    expect(r.target).toBe('subtree');
    expect(m.calls[0]?.target).toBe('one-child');
  });

  it('falls back to a plain input when only untargetable kinds are recent', () => {
    const m = fakeModule();
    const ms = [mistake('bst', 'unclassified', 1), mistake('bst', 'subtree', 45)];
    const r = reviewInput(m, 'bst', { reviews: 1 }, ms, NOW);
    expect(r.target).toBeNull();
    expect(m.calls[0]?.argc).toBe(1);
  });

  it('is deterministic for the same data', () => {
    const ms = [mistake('merge-sort', 'order', 1)];
    const a = reviewInput(fakeModule(), 'merge-sort', { reviews: 4 }, ms, NOW);
    const b = reviewInput(fakeModule(), 'merge-sort', { reviews: 4 }, ms, NOW);
    expect(a).toEqual(b);
    expect(a.target).toBe('order');
    expect(a.input).toEqual({ a: expect.any(Array) as unknown, t: 'duplicates' });
  });
});

describe('practiceUrl', () => {
  it('builds /t/<id> with the encoded targeted input, the seed, trace mode and level', () => {
    const m = fakeModule();
    const url = practiceUrl(m, 'dijkstra', 'stale', 'abc234', 'blind');
    expect(url).not.toBeNull();
    const [path, search] = (url ?? '').split('?');
    expect(path).toBe('/t/dijkstra');
    const q = parseQuery(search ?? '');
    expect(q).toEqual({ i: String(Math.floor(createRng('abc234').next() * 100)), t: 'stale', seed: 'abc234', mode: 'trace', level: 'blind' });
  });

  it('omits the level when none is given, and is null when the kind has no target', () => {
    const m = fakeModule();
    expect(practiceUrl(m, 'bfs', 'order', 'zz9zz9')).toMatch(/^\/t\/bfs\?i=\d+&t=wide&seed=zz9zz9&mode=trace$/);
    expect(practiceUrl(m, 'bfs', 'unclassified', 'zz9zz9')).toBeNull();
    expect(practiceUrl(m, 'bfs', 'stale', 'zz9zz9')).toBeNull();
    expect(m.calls).toHaveLength(1);
  });
});
