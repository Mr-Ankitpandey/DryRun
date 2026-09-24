import { describe, expect, it, vi } from 'vitest';
import { MAX_SESSIONS, MemoryStorage, createStorage, debouncedSaver, defaultStore, migrate } from './storage';
import type { SessionRecord, Store } from './storage';

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
