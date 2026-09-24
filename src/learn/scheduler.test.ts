import { describe, expect, it } from 'vitest';
import type { ReviewItem } from '@/lib/storage';
import { DAY_MS, afterSession, dueItems, enroll, estimateMinutes, intervalMs, reviewSeed, welcomeLine } from './scheduler';

const T0 = Date.UTC(2026, 8, 25, 12, 0, 0); // 2026-09-25T12:00Z

describe('scheduler: Leitner boxes', () => {
  it('enroll starts at box 0, due tomorrow', () => {
    expect(enroll('binary-search', T0)).toEqual({ algorithm: 'binary-search', box: 0, due: T0 + DAY_MS, reviews: 0, lastScore: 0 });
  });

  it('intervals are 1, 3, 7, 21, 60 days', () => {
    expect([0, 1, 2, 3, 4].map((b) => intervalMs(b as ReviewItem['box']) / DAY_MS)).toEqual([1, 3, 7, 21, 60]);
  });

  it('first session on an unknown algorithm: pass → box 1 (3 days), fail → box 0 (1 day)', () => {
    expect(afterSession(undefined, 'bst', 0.8, T0)).toEqual({ algorithm: 'bst', box: 1, due: T0 + 3 * DAY_MS, reviews: 1, lastScore: 0.8 });
    expect(afterSession(undefined, 'bst', 0.79, T0)).toEqual({ algorithm: 'bst', box: 0, due: T0 + DAY_MS, reviews: 1, lastScore: 0.79 });
  });

  it('promotes one box per passing session and caps at the 60-day box', () => {
    let item = enroll('bst', T0);
    const dues: number[] = [];
    for (let i = 0; i < 6; i++) {
      item = afterSession(item, 'bst', 1, T0 + i * DAY_MS);
      dues.push((item.due - (T0 + i * DAY_MS)) / DAY_MS);
    }
    expect(dues).toEqual([3, 7, 21, 60, 60, 60]);
    expect(item.box).toBe(4);
    expect(item.reviews).toBe(6);
    expect(item.lastScore).toBe(1);
  });

  it('demotes to box 0 on a failing session from any box', () => {
    const top: ReviewItem = { algorithm: 'bst', box: 4, due: 0, reviews: 9, lastScore: 1 };
    const out = afterSession(top, 'bst', 0.5, T0);
    expect(out).toEqual({ algorithm: 'bst', box: 0, due: T0 + DAY_MS, reviews: 10, lastScore: 0.5 });
    expect(top.box).toBe(4); // input untouched
  });

  it('dueItems returns overdue and just-due items sorted by due, then id', () => {
    const review: Record<string, ReviewItem> = {
      a: { algorithm: 'a', box: 0, due: T0 + 1, reviews: 0, lastScore: 0 },
      b: { algorithm: 'b', box: 1, due: T0 - 5, reviews: 1, lastScore: 1 },
      c: { algorithm: 'c', box: 2, due: T0, reviews: 2, lastScore: 1 },
      d: { algorithm: 'd', box: 2, due: T0 - 5, reviews: 2, lastScore: 1 },
    };
    expect(dueItems(review, T0).map((i) => i.algorithm)).toEqual(['b', 'd', 'c']);
    expect(dueItems({}, T0)).toEqual([]);
  });
});

describe('scheduler: seeds, minutes, copy', () => {
  it('reviewSeed is stable, short, URL-safe and changes per review and per algorithm', () => {
    const s = reviewSeed('binary-search', 3);
    expect(s).toBe(reviewSeed('binary-search', 3));
    expect(s).toMatch(/^[a-z2-9]{6}$/);
    expect(s).toBe('fprs98'); // pinned: a change here would silently change every review input
    expect(reviewSeed('binary-search', 4)).not.toBe(s);
    expect(reviewSeed('bst', 3)).not.toBe(s);
  });

  it('estimateMinutes sums known estimates and defaults the unknown', () => {
    const items = [enroll('binary-search', T0), enroll('dijkstra', T0), enroll('mystery', T0)];
    expect(estimateMinutes(items, { 'binary-search': 3, dijkstra: 6 })).toBe(12);
    expect(estimateMinutes([], { 'binary-search': 3 })).toBe(0);
  });

  it('welcomeLine copy variants', () => {
    const one = [enroll('a', T0)];
    const three = [enroll('a', T0), enroll('b', T0), enroll('c', T0)];
    expect(welcomeLine([], 0)).toBeNull();
    expect(welcomeLine(three, 4)).toBe('Welcome back — 3 re-traces due, ~4 minutes.');
    expect(welcomeLine(one, 1)).toBe('Welcome back — 1 re-trace due, ~1 minute.');
    expect(welcomeLine(one, 0)).toBe('Welcome back — 1 re-trace due, ~1 minute.');
    expect(welcomeLine(three, 4.2)).toBe('Welcome back — 3 re-traces due, ~5 minutes.');
  });
});
