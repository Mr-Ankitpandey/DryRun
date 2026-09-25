import { describe, expect, it } from 'vitest';
import { registry } from '@/algorithms/registry';
import type { ReviewItem, SessionRecord } from '@/lib/storage';
import { DAY_MS } from '@/learn/scheduler';
import { familiesIn, formatAccuracy, formatReview, libraryRows, reviewStatus } from './rows';
import type { LibraryEntry } from './rows';

const NOW = Date.UTC(2026, 8, 25, 12);

const entries: LibraryEntry[] = [
  { id: 'binary-search', title: 'Binary search', family: 'search', practice: 'p', minutes: 3 },
  { id: 'dijkstra', title: 'Dijkstra', family: 'graph', practice: 'p', minutes: 5 },
  { id: 'bst', title: 'BST', family: 'tree', practice: 'p', minutes: 4 },
];

const session = (over: Partial<SessionRecord>): SessionRecord => ({
  id: 'x',
  algorithm: 'binary-search',
  variant: 'classic',
  seed: 's',
  input: 'i=1&x=1',
  level: 'guided',
  asked: 4,
  correct: 3,
  startedAt: 0,
  finishedAt: 0,
  ...over,
});

const item = (over: Partial<ReviewItem>): ReviewItem => ({ algorithm: 'binary-search', box: 0, due: NOW, reviews: 0, lastScore: 0, ...over });

describe('libraryRows', () => {
  it('keeps registry order and links each row to its trace', () => {
    const rows = libraryRows(entries, [], {}, NOW);
    expect(rows.map((r) => r.id)).toEqual(['binary-search', 'dijkstra', 'bst']);
    expect(rows.map((r) => r.href)).toEqual(['/t/binary-search', '/t/dijkstra', '/t/bst']);
  });

  it('accuracy is null (not zero) when nothing was graded, including watch-only sessions', () => {
    const rows = libraryRows(entries, [session({ algorithm: 'dijkstra', asked: 0, correct: 0 })], {}, NOW);
    for (const r of rows) {
      expect(r.accuracy).toBeNull();
      expect(r.asked).toBe(0);
    }
    expect(formatAccuracy(rows[0]?.accuracy ?? null)).toBe('—');
  });

  it('sums graded answers over every session of the algorithm', () => {
    const rows = libraryRows(
      entries,
      [session({ id: 'a', asked: 4, correct: 3 }), session({ id: 'b', asked: 2, correct: 2 }), session({ id: 'c', algorithm: 'bst', asked: 5, correct: 0 })],
      {},
      NOW,
    );
    expect(rows[0]).toMatchObject({ asked: 6, correct: 5, accuracy: 5 / 6 });
    expect(rows[2]).toMatchObject({ asked: 5, correct: 0, accuracy: 0 });
    expect(formatAccuracy(rows[0]?.accuracy ?? null)).toBe('83%');
    expect(formatAccuracy(rows[2]?.accuracy ?? null)).toBe('0%');
  });

  it('ignores sessions of algorithms that are not in the list', () => {
    const rows = libraryRows(entries, [session({ algorithm: 'knapsack' })], {}, NOW);
    expect(rows.every((r) => r.accuracy === null)).toBe(true);
  });

  it('review status: none, due (at or before now), or whole days until due rounded up', () => {
    expect(reviewStatus(undefined, NOW)).toEqual({ kind: 'none' });
    expect(reviewStatus(item({ due: NOW }), NOW)).toEqual({ kind: 'due' });
    expect(reviewStatus(item({ due: NOW - 1 }), NOW)).toEqual({ kind: 'due' });
    expect(reviewStatus(item({ due: NOW + 1 }), NOW)).toEqual({ kind: 'later', days: 1 });
    expect(reviewStatus(item({ due: NOW + 3 * DAY_MS }), NOW)).toEqual({ kind: 'later', days: 3 });
    expect(reviewStatus(item({ due: NOW + 3 * DAY_MS + 1 }), NOW)).toEqual({ kind: 'later', days: 4 });
    expect(formatReview({ kind: 'none' })).toBe('—');
    expect(formatReview({ kind: 'due' })).toBe('Due now');
    expect(formatReview({ kind: 'later', days: 1 })).toBe('In 1 day');
    expect(formatReview({ kind: 'later', days: 7 })).toBe('In 7 days');
  });

  it('rows carry the review item of their own algorithm only', () => {
    const rows = libraryRows(entries, [], { dijkstra: item({ algorithm: 'dijkstra', due: NOW - DAY_MS }) }, NOW);
    expect(rows.map((r) => r.review.kind)).toEqual(['none', 'due', 'none']);
  });
});

describe('familiesIn', () => {
  it('lists present families in teaching order', () => {
    expect(familiesIn(entries)).toEqual(['search', 'tree', 'graph']);
    expect(familiesIn([])).toEqual([]);
  });

  it('covers every registry entry', () => {
    const fams = familiesIn(registry);
    for (const e of registry) expect(fams).toContain(e.family);
  });
});
