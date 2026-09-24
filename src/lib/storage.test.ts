import { describe, expect, it, vi } from 'vitest';
import {
  MAX_MISTAKES,
  MAX_SESSIONS,
  MemoryStorage,
  appendMistakes,
  appendSession,
  createStorage,
  debouncedSaver,
  defaultStore,
  migrate,
  touch,
  upsertReview,
} from './storage';
import type { MistakeRecord, ReviewItem, SessionRecord, Store } from './storage';

const mistake = (i: number): MistakeRecord => ({
  id: `m${i}`,
  algorithm: 'binary-search',
  kind: 'boundary',
  rule: 'r',
  seed: 's',
  input: 'i=1&x=1',
  askIndex: i,
  at: i,
});

const session = (i: number): SessionRecord => ({
  id: `s${i}`,
  algorithm: 'binary-search',
  variant: 'classic',
  seed: 'abc',
  input: 'i=1,2&x=2',
  level: 'guided',
  asked: 5,
  correct: 4,
  startedAt: i,
  finishedAt: i + 1,
});

describe('storage', () => {
  it('starts fresh when nothing is stored, and flags corrupt data as recovered', () => {
    const backend = new MemoryStorage();
    const st = createStorage(backend);
    expect(st.load()).toEqual({ store: defaultStore(), recovered: false });
    backend.setItem('dryrun.v1', '{not json');
    expect(st.load().recovered).toBe(true);
    backend.setItem('dryrun.v1', JSON.stringify({ version: 99 }));
    expect(st.load().recovered).toBe(true);
  });

  it('saves and reloads a store, trimming to the session cap', () => {
    const st = createStorage(new MemoryStorage());
    const store: Store = { ...defaultStore(), sessions: Array.from({ length: MAX_SESSIONS + 10 }, (_, i) => session(i)) };
    st.save(store);
    const { store: back } = st.load();
    expect(back.sessions).toHaveLength(MAX_SESSIONS);
    expect(back.sessions[0]?.id).toBe('s10');
  });

  it('migrate drops malformed records and normalises settings', () => {
    const out = migrate({
      version: 1,
      settings: { theme: 'purple', motion: 'reduced', level: 'full' },
      sessions: [session(1), { id: 'bad' }],
      mistakes: [{ id: 'm', algorithm: 'a', kind: 'boundary', rule: 'r', seed: 's', input: 'i', askIndex: 0, at: 1 }, 'junk'],
      review: { 'binary-search': { algorithm: 'binary-search', box: 2, due: 5, reviews: 1, lastScore: 0.8 }, bad: { box: 9 } },
    });
    expect(out?.settings).toEqual({ theme: 'system', motion: 'reduced', level: 'full' });
    expect(out?.sessions).toHaveLength(1);
    expect(out?.mistakes).toHaveLength(1);
    expect(Object.keys(out?.review ?? {})).toEqual(['binary-search']);
  });

  it('export/import round-trips and rejects garbage', () => {
    const st = createStorage(new MemoryStorage());
    const store: Store = { ...defaultStore(), sessions: [session(1)] };
    const json = st.exportJson(store);
    expect(st.importJson(json)).toEqual(store);
    expect(st.importJson('nope')).toBeNull();
    expect(st.importJson('{"version":2}')).toBeNull();
  });

  it('survives a backend that throws on write', () => {
    const backend = new MemoryStorage();
    backend.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const st = createStorage(backend);
    expect(() => st.save(defaultStore())).not.toThrow();
  });

  it('debounces saves', () => {
    vi.useFakeTimers();
    const backend = new MemoryStorage();
    const st = createStorage(backend);
    const save = debouncedSaver(st, 100);
    save({ ...defaultStore(), sessions: [session(1)] });
    save({ ...defaultStore(), sessions: [session(1), session(2)] });
    expect(backend.getItem('dryrun.v1')).toBeNull();
    vi.advanceTimersByTime(100);
    expect(st.load().store.sessions).toHaveLength(2);
    vi.useRealTimers();
  });
});

describe('storage schema extensions', () => {
  it('migrate reads meta strictly and defaults it when missing or malformed', () => {
    expect(migrate({ version: 1 })?.meta).toEqual({ firstSeen: null, lastSeen: null });
    expect(migrate({ version: 1, meta: { firstSeen: 5, lastSeen: 9 } })?.meta).toEqual({ firstSeen: 5, lastSeen: 9 });
    expect(migrate({ version: 1, meta: { firstSeen: '5', lastSeen: Number.NaN } })?.meta).toEqual({ firstSeen: null, lastSeen: null });
    expect(migrate({ version: 1, meta: 'nope' })?.meta).toEqual({ firstSeen: null, lastSeen: null });
  });

  it('migrate rejects unknown mistake kinds and non-integer boxes', () => {
    const out = migrate({
      version: 1,
      mistakes: [mistake(1), { ...mistake(2), kind: 'typo' }],
      review: { a: { algorithm: 'a', box: 2.5, due: 1, reviews: 1, lastScore: 1 }, b: { algorithm: 'b', box: 4, due: 1, reviews: 1, lastScore: 1 } },
    });
    expect(out?.mistakes.map((m) => m.id)).toEqual(['m1']);
    expect(Object.keys(out?.review ?? {})).toEqual(['b']);
  });

  it('export/import round-trips meta and review', () => {
    const st = createStorage(new MemoryStorage());
    const store = upsertReview(touch(defaultStore(), 42), { algorithm: 'bst', box: 3, due: 99, reviews: 4, lastScore: 0.9 });
    expect(st.importJson(st.exportJson(store))).toEqual(store);
  });

  it('touch sets firstSeen once, moves lastSeen forward, and returns the same object when nothing changes', () => {
    const s0 = defaultStore();
    const s1 = touch(s0, 100);
    expect(s0.meta).toEqual({ firstSeen: null, lastSeen: null });
    expect(s1.meta).toEqual({ firstSeen: 100, lastSeen: 100 });
    const s2 = touch(s1, 300);
    expect(s2.meta).toEqual({ firstSeen: 100, lastSeen: 300 });
    expect(touch(s2, 200)).toBe(s2);
    expect(touch(s2, 50).meta).toEqual({ firstSeen: 50, lastSeen: 300 });
  });

  it('upsertReview adds and replaces by algorithm without mutating', () => {
    const a: ReviewItem = { algorithm: 'a', box: 0, due: 1, reviews: 0, lastScore: 0 };
    const s0 = defaultStore();
    const s1 = upsertReview(s0, a);
    const s2 = upsertReview(s1, { ...a, box: 1 });
    expect(s0.review).toEqual({});
    expect(s1.review.a?.box).toBe(0);
    expect(s2.review.a?.box).toBe(1);
    expect(Object.keys(s2.review)).toEqual(['a']);
  });

  it('appendSession replaces a record with the same id and trims to the cap', () => {
    let s = defaultStore();
    for (let i = 0; i < MAX_SESSIONS + 3; i++) s = appendSession(s, session(i));
    expect(s.sessions).toHaveLength(MAX_SESSIONS);
    expect(s.sessions[0]?.id).toBe('s3');
    const again = appendSession(s, { ...session(10), correct: 0 });
    expect(again.sessions).toHaveLength(MAX_SESSIONS);
    expect(again.sessions.filter((x) => x.id === 's10')).toHaveLength(1);
    expect(again.sessions.at(-1)?.id).toBe('s10');
    expect(again.sessions.at(-1)?.correct).toBe(0);
  });

  it('appendMistakes dedupes by id, trims to the cap and is a no-op for an empty list', () => {
    const s0 = defaultStore();
    expect(appendMistakes(s0, [])).toBe(s0);
    const s1 = appendMistakes(s0, [mistake(1), mistake(2)]);
    const s2 = appendMistakes(s1, [{ ...mistake(2), kind: 'stale' }, mistake(3)]);
    expect(s0.mistakes).toEqual([]);
    expect(s2.mistakes.map((m) => [m.id, m.kind])).toEqual([
      ['m1', 'boundary'],
      ['m2', 'stale'],
      ['m3', 'boundary'],
    ]);
    const many = Array.from({ length: MAX_MISTAKES + 5 }, (_, i) => mistake(i));
    expect(appendMistakes(s0, many).mistakes).toHaveLength(MAX_MISTAKES);
    expect(appendMistakes(s0, many).mistakes[0]?.id).toBe('m5');
  });
});
