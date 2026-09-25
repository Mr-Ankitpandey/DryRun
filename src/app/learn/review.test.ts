import { describe, expect, it } from 'vitest';
import { binarySearch } from '@/algorithms/binary-search';
import { run } from '@/engine/run';
import type { ReviewItem } from '@/lib/storage';
import { DAY_MS } from '@/learn/scheduler';
import { createSession, encodeInput, submit } from '@/trace/session';
import type { ItemResult } from './review';
import { itemResult, nextDueSentence, nextUpcoming, resultLine, totalsLine } from './review';

const basic = { a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 42, variant: 'classic' as const };
const basicRun = run(binarySearch.initialState(basic), binarySearch.generate(basic));
const meta = { algorithm: 'binary-search', variant: 'classic', seed: 'k9d2', input: encodeInput(binarySearch.encode(basic)), startedAt: 1_000 };

describe('itemResult', () => {
  it('counts right answers and mistakes by kind from a real session', () => {
    let s = createSession(basicRun, 'guided', meta);
    s = submit(s, 'e:0', 10).session; // boundary
    s = submit(s, 'e:5', 20).session; // right
    s = submit(s, 'e:1', 30).session; // unclassified
    const r = itemResult(s, 'Binary search');
    expect(r).toEqual({
      algorithm: 'binary-search',
      title: 'Binary search',
      asked: 3,
      correct: 1,
      mistakes: [
        { kind: 'boundary', count: 1 },
        { kind: 'unclassified', count: 1 },
      ],
    });
    expect(resultLine(r)).toBe('Binary search: 1 of 3 right, 1 boundary and 1 unclassified mistakes.');
  });
});

const res = (over: Partial<ItemResult>): ItemResult => ({ algorithm: 'dijkstra', title: 'Dijkstra', asked: 8, correct: 7, mistakes: [], ...over });

describe('resultLine and totalsLine', () => {
  it('reads as one short sentence', () => {
    expect(resultLine(res({ mistakes: [{ kind: 'stale', count: 1 }] }))).toBe('Dijkstra: 7 of 8 right, 1 stale-entry mistake.');
    expect(resultLine(res({ correct: 8 }))).toBe('Dijkstra: 8 of 8 right, no mistakes.');
    expect(
      resultLine(res({ correct: 4, mistakes: [{ kind: 'stale', count: 2 }, { kind: 'order', count: 1 }, { kind: 'boundary', count: 1 }] })),
    ).toBe('Dijkstra: 4 of 8 right, 2 stale-entry, 1 order and 1 boundary mistakes.');
    expect(resultLine(res({ asked: 0, correct: 0 }))).toBe('Dijkstra: finished, nothing was asked at this level.');
  });
  it('totals across items', () => {
    expect(totalsLine([res({}), res({ asked: 6, correct: 6 })])).toBe('2 re-traces, 13 of 14 right.');
    expect(totalsLine([res({ asked: 0, correct: 0 })])).toBe('1 re-trace, nothing was asked.');
  });
});

describe('nextUpcoming and nextDueSentence', () => {
  const NOW = 100 * DAY_MS;
  const item = (algorithm: string, due: number): ReviewItem => ({ algorithm, box: 1, due, reviews: 1, lastScore: 1 });
  const review = { a: item('a', NOW - 1), b: item('b', NOW + 3 * DAY_MS), c: item('c', NOW + DAY_MS) };
  it('skips due items and picks the earliest upcoming one', () => {
    expect(nextUpcoming(review, NOW)?.algorithm).toBe('c');
    expect(nextUpcoming({ a: item('a', NOW) }, NOW)).toBeNull();
    expect(nextUpcoming({}, NOW)).toBeNull();
  });
  it('says when, with the title', () => {
    expect(nextDueSentence(review, NOW, (id) => id.toUpperCase())).toBe('Your next re-trace is C, due tomorrow.');
    expect(nextDueSentence({}, NOW, (id) => id)).toBeNull();
  });
});
