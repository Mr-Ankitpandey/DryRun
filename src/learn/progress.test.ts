import { describe, expect, it } from 'vitest';
import type { MistakeRecord, SessionRecord } from '@/lib/storage';
import { MIN_SESSIONS_FOR_PROGRESS, localCalendar, progress, utcCalendar } from './progress';

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
const mistake = (over: Partial<MistakeRecord>): MistakeRecord => ({
  id: 'm',
  algorithm: 'binary-search',
  kind: 'boundary',
  rule: 'r',
  seed: 's',
  input: 'i=1&x=1',
  askIndex: 1,
  at: 0,
  ...over,
});

const NOW = Date.UTC(2026, 9, 2, 10, 0, 0); // 2026-10-02T10:00Z

describe('progress', () => {
  it('empty input gives an honest empty state with a full day axis', () => {
    const p = progress([], [], NOW);
    expect(p.hasEnoughData).toBe(false);
    expect(p.sessions).toBe(0);
    expect(p.overall).toEqual({ asked: 0, correct: 0, accuracy: null });
    expect(p.byAlgorithm).toEqual([]);
    expect(p.mistakesByKind).toEqual([]);
    expect(p.days).toHaveLength(30);
    expect(p.days[0]).toBe('2026-09-03');
    expect(p.days.at(-1)).toBe('2026-10-02');
  });

  it('buckets sessions by UTC day across the month boundary and drops sessions outside the window', () => {
    const sessions = [
      session({ id: 'a', finishedAt: Date.UTC(2026, 8, 30, 23, 59), asked: 4, correct: 4 }),
      session({ id: 'b', finishedAt: Date.UTC(2026, 9, 1, 0, 0), asked: 4, correct: 2 }),
      session({ id: 'c', finishedAt: Date.UTC(2026, 9, 1, 12, 0), asked: 2, correct: 2 }),
      session({ id: 'd', finishedAt: Date.UTC(2026, 9, 2, 9, 0), asked: 5, correct: 1, algorithm: 'dijkstra' }),
      session({ id: 'edge-in', finishedAt: Date.UTC(2026, 8, 3, 0, 0), asked: 1, correct: 1 }),
      session({ id: 'edge-out', finishedAt: Date.UTC(2026, 8, 2, 23, 59, 59), asked: 9, correct: 9 }),
      session({ id: 'future', finishedAt: NOW + 1, asked: 9, correct: 9 }),
      session({ id: 'watch', finishedAt: NOW, asked: 0, correct: 0 }),
    ];
    const p = progress(sessions, [], NOW);
    expect(p.sessions).toBe(5);
    expect(p.hasEnoughData).toBe(true);
    expect(p.overall).toEqual({ asked: 16, correct: 10, accuracy: 10 / 16 });
    expect(p.byAlgorithm.map((a) => a.algorithm)).toEqual(['binary-search', 'dijkstra']);
    const bs = p.byAlgorithm[0];
    expect(bs?.sessions).toBe(4);
    expect(bs?.asked).toBe(11);
    expect(bs?.correct).toBe(9);
    expect(bs?.series).toHaveLength(30);
    const byDate = Object.fromEntries((bs?.series ?? []).map((pt) => [pt.date, pt]));
    expect(byDate['2026-09-03']).toEqual({ date: '2026-09-03', asked: 1, correct: 1, accuracy: 1 });
    expect(byDate['2026-09-30']).toEqual({ date: '2026-09-30', asked: 4, correct: 4, accuracy: 1 });
    expect(byDate['2026-10-01']).toEqual({ date: '2026-10-01', asked: 6, correct: 4, accuracy: 4 / 6 });
    expect(byDate['2026-10-02']).toEqual({ date: '2026-10-02', asked: 0, correct: 0, accuracy: null });
    const dj = p.byAlgorithm[1];
    expect(dj?.series.at(-1)).toEqual({ date: '2026-10-02', asked: 5, correct: 1, accuracy: 0.2 });
    expect(dj?.series.filter((pt) => pt.asked > 0)).toHaveLength(1);
  });

  it('hasEnoughData needs three graded sessions in the window', () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => session({ id: `s${i}`, finishedAt: NOW - i }));
    expect(progress(mk(MIN_SESSIONS_FOR_PROGRESS - 1), [], NOW).hasEnoughData).toBe(false);
    expect(progress(mk(MIN_SESSIONS_FOR_PROGRESS), [], NOW).hasEnoughData).toBe(true);
    const old = mk(5).map((s) => ({ ...s, finishedAt: NOW - 40 * 24 * 3600 * 1000 }));
    expect(progress(old, [], NOW).hasEnoughData).toBe(false);
  });

  it('counts mistakes by kind inside the window only, most frequent first', () => {
    const mistakes = [
      mistake({ id: '1', at: NOW - 1000, kind: 'stale' }),
      mistake({ id: '2', at: NOW - 2000, kind: 'stale' }),
      mistake({ id: '3', at: NOW - 3000, kind: 'boundary' }),
      mistake({ id: '4', at: Date.UTC(2026, 7, 1), kind: 'boundary' }),
      mistake({ id: '5', at: NOW + 5, kind: 'comparison' }),
    ];
    expect(progress([], mistakes, NOW).mistakesByKind).toEqual([
      { kind: 'stale', label: 'Stale entry', count: 2 },
      { kind: 'boundary', label: 'Boundary / off-by-one', count: 1 },
    ]);
  });

  it('honours a custom window length', () => {
    const p = progress([], [], NOW, { days: 7 });
    expect(p.days).toEqual(['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('calendars produce YYYY-MM-DD keys and step back whole days', () => {
    expect(utcCalendar.key(NOW)).toBe('2026-10-02');
    expect(utcCalendar.key(utcCalendar.back(NOW, 32))).toBe('2026-08-31');
    expect(localCalendar.key(NOW)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const keys = new Set<string>();
    for (let i = 0; i < 60; i++) keys.add(localCalendar.key(localCalendar.back(NOW, i)));
    expect(keys.size).toBe(60);
  });
});
