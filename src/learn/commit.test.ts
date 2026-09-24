import { describe, expect, it } from 'vitest';
import { binarySearch } from '@/algorithms/binary-search';
import { run } from '@/engine/run';
import { defaultStore } from '@/lib/storage';
import { createSession, encodeInput, skip, submit } from '@/trace/session';
import { commitSession, startAlgorithm } from './commit';
import { DAY_MS } from './scheduler';

const basic = { a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 42, variant: 'classic' as const };
const basicRun = run(binarySearch.initialState(basic), binarySearch.generate(basic));
const meta = { algorithm: 'binary-search', variant: 'classic', seed: 'k9d2', input: encodeInput(binarySearch.encode(basic)), startedAt: 1_000 };

describe('startAlgorithm', () => {
  it('enrols a new algorithm once and stamps activity', () => {
    const s1 = startAlgorithm(defaultStore(), 'binary-search', 500);
    expect(s1.review['binary-search']).toEqual({ algorithm: 'binary-search', box: 0, due: 500 + DAY_MS, reviews: 0, lastScore: 0 });
    expect(s1.meta).toEqual({ firstSeen: 500, lastSeen: 500 });
    const s2 = startAlgorithm({ ...s1, review: { 'binary-search': { algorithm: 'binary-search', box: 3, due: 1, reviews: 2, lastScore: 1 } } }, 'binary-search', 900);
    expect(s2.review['binary-search']?.box).toBe(3);
    expect(s2.meta.lastSeen).toBe(900);
  });
});

describe('commitSession', () => {
  it('records a passing session: record, no mistakes, box promoted', () => {
    let s = createSession(basicRun, 'guided', meta);
    for (const given of ['e:4', 'e:5', 'e:6', 'e:7', 'e:7', 7] as const) s = submit(s, given, 2_000).session;
    const { store, record, mistakes, review } = commitSession(startAlgorithm(defaultStore(), 'binary-search', 1_000), s, 5_000);
    expect(record.asked).toBe(6);
    expect(record.correct).toBe(6);
    expect(mistakes).toEqual([]);
    expect(review).toEqual({ algorithm: 'binary-search', box: 1, due: 5_000 + 3 * DAY_MS, reviews: 1, lastScore: 1 });
    expect(store.sessions).toEqual([record]);
    expect(store.mistakes).toEqual([]);
    expect(store.review['binary-search']).toEqual(review);
    expect(store.meta).toEqual({ firstSeen: 1_000, lastSeen: 5_000 });
  });

  it('records a failing session: mistakes stored, box reset, previous store untouched', () => {
    let s = createSession(basicRun, 'guided', meta);
    s = submit(s, 'e:0', 10).session; // boundary
    s = submit(s, 'e:5', 20).session;
    s = submit(s, 'e:1', 30).session; // unclassified
    const before = { ...defaultStore(), review: { 'binary-search': { algorithm: 'binary-search', box: 3 as const, due: 0, reviews: 4, lastScore: 1 } } };
    const snapshot = structuredClone(before);
    const { store, mistakes, review } = commitSession(before, s, 40);
    expect(before).toEqual(snapshot);
    expect(mistakes.map((m) => m.kind)).toEqual(['boundary', 'unclassified']);
    expect(store.mistakes).toEqual(mistakes);
    expect(review.box).toBe(0);
    expect(review.reviews).toBe(5);
    expect(review.lastScore).toBeCloseTo(1 / 3);
    expect(store.sessions[0]?.asked).toBe(3);
    expect(store.sessions[0]?.correct).toBe(1);
  });

  it('a watch-only session (nothing asked) keeps the review item as is, or enrols it', () => {
    let s = createSession(basicRun, 'guided', meta);
    while (s.gate !== null) s = skip(s);
    const fresh = commitSession(defaultStore(), s, 77);
    expect(fresh.review).toEqual({ algorithm: 'binary-search', box: 0, due: 77 + DAY_MS, reviews: 0, lastScore: 0 });
    expect(fresh.record.asked).toBe(0);
    const existing = { algorithm: 'binary-search', box: 2 as const, due: 5, reviews: 2, lastScore: 0.9 };
    const kept = commitSession({ ...defaultStore(), review: { 'binary-search': existing } }, s, 77);
    expect(kept.review).toEqual(existing);
    expect(kept.store.sessions).toHaveLength(1);
  });

  it('committing the same session twice does not duplicate records', () => {
    let s = createSession(basicRun, 'guided', meta);
    s = submit(s, 'e:0', 10).session;
    const once = commitSession(defaultStore(), s, 40).store;
    const twice = commitSession(once, s, 41).store;
    expect(twice.sessions).toHaveLength(1);
    expect(twice.mistakes).toHaveLength(1);
  });
});
