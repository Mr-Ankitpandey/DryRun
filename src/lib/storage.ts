/** Local-only persistence: one JSON document in localStorage, versioned, with
 *  migrations, export and import. The backend is injectable so tests run in node. */

import type { MistakeKind } from '@/trace/asks';
import { MISTAKE_LABELS } from '@/trace/asks';

export const STORAGE_KEY = 'dryrun.v1';
export const CURRENT_VERSION = 1 as const;

export type Theme = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'reduced';
export type Level = 'guided' | 'full';

export interface Settings {
  theme: Theme;
  motion: MotionPref;
  level: Level;
}

export interface SessionRecord {
  id: string;
  algorithm: string;
  variant: string;
  seed: string;
  input: string; // encoded input (module codec)
  level: Level;
  asked: number;
  correct: number;
  startedAt: number;
  finishedAt: number;
}

export interface MistakeRecord {
  id: string;
  algorithm: string;
  kind: MistakeKind;
  rule: string;
  seed: string;
  input: string;
  askIndex: number;
  at: number;
}

export interface ReviewItem {
  algorithm: string;
  box: 0 | 1 | 2 | 3 | 4;
  due: number;
  reviews: number;
  lastScore: number;
}

export interface StoreMeta {
  /** First time the app recorded anything (ms epoch), null until then. */
  firstSeen: number | null;
  /** Most recent time the app recorded anything (ms epoch), null until then. */
  lastSeen: number | null;
}

export interface Store {
  version: typeof CURRENT_VERSION;
  settings: Settings;
  meta: StoreMeta;
  sessions: SessionRecord[];
  mistakes: MistakeRecord[];
  review: Record<string, ReviewItem>;
}

export const MAX_SESSIONS = 500;
export const MAX_MISTAKES = 2000;

export function defaultStore(): Store {
  return {
    version: CURRENT_VERSION,
    settings: { theme: 'system', motion: 'system', level: 'guided' },
    meta: { firstSeen: null, lastSeen: null },
    sessions: [],
    mistakes: [],
    review: {},
  };
}

/** Returns a store with `meta.firstSeen`/`lastSeen` updated for activity at `now`. */
export function touch(store: Store, now: number): Store {
  const firstSeen = store.meta.firstSeen === null ? now : Math.min(store.meta.firstSeen, now);
  const lastSeen = store.meta.lastSeen === null ? now : Math.max(store.meta.lastSeen, now);
  if (firstSeen === store.meta.firstSeen && lastSeen === store.meta.lastSeen) return store;
  return { ...store, meta: { firstSeen, lastSeen } };
}

/** Returns a store with the review item for its algorithm replaced or added. */
export function upsertReview(store: Store, item: ReviewItem): Store {
  return { ...store, review: { ...store.review, [item.algorithm]: item } };
}

/** Returns a store with the session appended (replacing one with the same id), trimmed to the cap. */
export function appendSession(store: Store, record: SessionRecord): Store {
  const sessions = [...store.sessions.filter((s) => s.id !== record.id), record].slice(-MAX_SESSIONS);
  return { ...store, sessions };
}

/** Returns a store with the mistakes appended (replacing any with the same ids), trimmed to the cap. */
export function appendMistakes(store: Store, records: readonly MistakeRecord[]): Store {
  if (records.length === 0) return store;
  const ids = new Set(records.map((m) => m.id));
  const mistakes = [...store.mistakes.filter((m) => !ids.has(m.id)), ...records].slice(-MAX_MISTAKES);
  return { ...store, mistakes };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validates an unknown value into a Store, applying migrations from older
 *  versions. Returns null when the data is unusable (caller starts fresh). */
export function migrate(raw: unknown): Store | null {
  if (!isRecord(raw)) return null;
  const version = raw.version;
  if (version !== 1) return null; // future: chain v1 → v2 steps here
  const base = defaultStore();
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const theme = settings.theme;
  const motion = settings.motion;
  const level = settings.level;
  base.settings = {
    theme: theme === 'light' || theme === 'dark' ? theme : 'system',
    motion: motion === 'reduced' ? 'reduced' : 'system',
    level: level === 'full' ? 'full' : 'guided',
  };
  const meta = isRecord(raw.meta) ? raw.meta : {};
  base.meta = {
    firstSeen: typeof meta.firstSeen === 'number' && Number.isFinite(meta.firstSeen) ? meta.firstSeen : null,
    lastSeen: typeof meta.lastSeen === 'number' && Number.isFinite(meta.lastSeen) ? meta.lastSeen : null,
  };
  base.sessions = Array.isArray(raw.sessions)
    ? raw.sessions.filter(isSession).slice(-MAX_SESSIONS)
    : [];
  base.mistakes = Array.isArray(raw.mistakes)
    ? raw.mistakes.filter(isMistake).slice(-MAX_MISTAKES)
    : [];
  base.review = {};
  if (isRecord(raw.review)) {
    for (const [k, v] of Object.entries(raw.review)) {
      if (isReviewItem(v)) base.review[k] = v;
    }
  }
  return base;
}

function isSession(v: unknown): v is SessionRecord {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.algorithm === 'string' &&
    typeof v.variant === 'string' &&
    typeof v.seed === 'string' &&
    typeof v.input === 'string' &&
    (v.level === 'guided' || v.level === 'full') &&
    typeof v.asked === 'number' &&
    typeof v.correct === 'number' &&
    typeof v.startedAt === 'number' &&
    typeof v.finishedAt === 'number'
  );
}

function isMistake(v: unknown): v is MistakeRecord {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.algorithm === 'string' &&
    typeof v.kind === 'string' &&
    v.kind in MISTAKE_LABELS &&
    typeof v.rule === 'string' &&
    typeof v.seed === 'string' &&
    typeof v.input === 'string' &&
    typeof v.askIndex === 'number' &&
    typeof v.at === 'number'
  );
}

function isReviewItem(v: unknown): v is ReviewItem {
  return (
    isRecord(v) &&
    typeof v.algorithm === 'string' &&
    Number.isInteger(v.box) &&
    (v.box as number) >= 0 &&
    (v.box as number) <= 4 &&
    typeof v.due === 'number' &&
    typeof v.reviews === 'number' &&
    typeof v.lastScore === 'number'
  );
}

export interface Storage {
  load(): { store: Store; recovered: boolean };
  save(store: Store): void;
  clear(): void;
  exportJson(store: Store): string;
  importJson(json: string): Store | null;
}

export function createStorage(backend: StorageLike, key = STORAGE_KEY): Storage {
  return {
    load() {
      let raw: string | null;
      try {
        raw = backend.getItem(key);
      } catch {
        return { store: defaultStore(), recovered: false };
      }
      if (raw === null) return { store: defaultStore(), recovered: false };
      try {
        const parsed: unknown = JSON.parse(raw);
        const store = migrate(parsed);
        if (store) return { store, recovered: false };
      } catch {
        // fall through: corrupt data
      }
      return { store: defaultStore(), recovered: true };
    },
    save(store) {
      const trimmed: Store = {
        ...store,
        sessions: store.sessions.slice(-MAX_SESSIONS),
        mistakes: store.mistakes.slice(-MAX_MISTAKES),
      };
      try {
        backend.setItem(key, JSON.stringify(trimmed));
      } catch {
        // Quota exceeded or storage disabled: keep the newest half and retry once.
        const half: Store = {
          ...trimmed,
          sessions: trimmed.sessions.slice(-Math.floor(MAX_SESSIONS / 2)),
          mistakes: trimmed.mistakes.slice(-Math.floor(MAX_MISTAKES / 2)),
        };
        try {
          backend.setItem(key, JSON.stringify(half));
        } catch {
          // Give up silently; the app keeps working in memory.
        }
      }
    },
    clear() {
      try {
        backend.removeItem(key);
      } catch {
        // ignore
      }
    },
    exportJson(store) {
      return JSON.stringify(store, null, 2);
    },
    importJson(json) {
      try {
        return migrate(JSON.parse(json));
      } catch {
        return null;
      }
    },
  };
}

/** Debounces saves so rapid UI updates do not hammer localStorage. */
export function debouncedSaver(storage: Storage, delayMs = 250): (store: Store) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Store | null = null;
  return (store) => {
    pending = store;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (pending) storage.save(pending);
      pending = null;
    }, delayMs);
  };
}
