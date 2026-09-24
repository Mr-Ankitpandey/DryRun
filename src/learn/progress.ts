/** Progress aggregation for the Progress screen (docs/DESIGN.md §5): accuracy
 *  per algorithm as a daily series over the last N calendar days, overall
 *  accuracy, mistakes by kind, and an honest "not enough data" flag. Pure. */

import type { MistakeKind } from '@/trace/asks';
import { MISTAKE_LABELS } from '@/trace/asks';
import type { MistakeRecord, SessionRecord } from '@/lib/storage';

/** How timestamps map to calendar days. UTC is the deterministic default; screens pass `localCalendar`. */
export interface Calendar {
  /** 'YYYY-MM-DD' for a timestamp. */
  key(ts: number): string;
  /** The timestamp `days` calendar days earlier (same wall-clock time). */
  back(ts: number, days: number): number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export const utcCalendar: Calendar = {
  key: (ts) => new Date(ts).toISOString().slice(0, 10),
  back: (ts, days) => {
    const d = new Date(ts);
    d.setUTCDate(d.getUTCDate() - days);
    return d.getTime();
  },
};

export const localCalendar: Calendar = {
  key: (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  },
  back: (ts, days) => {
    const d = new Date(ts);
    d.setDate(d.getDate() - days);
    return d.getTime();
  },
};

export interface DailyPoint {
  date: string;
  asked: number;
  correct: number;
  /** correct / asked, null on days with nothing asked. */
  accuracy: number | null;
}

export interface AlgorithmProgress {
  algorithm: string;
  sessions: number;
  asked: number;
  correct: number;
  accuracy: number | null;
  /** One point per day in the window, oldest first, zero-filled. */
  series: DailyPoint[];
}

export interface Progress {
  /** Calendar days covered, oldest first. */
  days: string[];
  /** Graded sessions (asked > 0) inside the window. */
  sessions: number;
  hasEnoughData: boolean;
  overall: { asked: number; correct: number; accuracy: number | null };
  /** Most asked first; ties by algorithm id. */
  byAlgorithm: AlgorithmProgress[];
  /** Mistakes inside the window, most frequent first. */
  mistakesByKind: { kind: MistakeKind; label: string; count: number }[];
}

export const PROGRESS_DAYS = 30;
export const MIN_SESSIONS_FOR_PROGRESS = 3;

const ratio = (correct: number, asked: number): number | null => (asked === 0 ? null : correct / asked);

/** Aggregates sessions and mistakes over the last `days` calendar days ending at `now`. */
export function progress(
  sessions: readonly SessionRecord[],
  mistakes: readonly MistakeRecord[],
  now: number,
  opts: { days?: number; calendar?: Calendar } = {},
): Progress {
  const days = opts.days ?? PROGRESS_DAYS;
  const cal = opts.calendar ?? utcCalendar;
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(cal.key(cal.back(now, i)));
  const inWindow = new Set(keys);
  const graded = sessions.filter((s) => s.asked > 0 && s.finishedAt <= now && inWindow.has(cal.key(s.finishedAt)));

  const perAlg = new Map<string, SessionRecord[]>();
  for (const s of graded) perAlg.set(s.algorithm, [...(perAlg.get(s.algorithm) ?? []), s]);

  const byAlgorithm: AlgorithmProgress[] = [...perAlg.entries()]
    .map(([algorithm, list]) => {
      const byDay = new Map<string, { asked: number; correct: number }>();
      for (const s of list) {
        const k = cal.key(s.finishedAt);
        const cur = byDay.get(k) ?? { asked: 0, correct: 0 };
        byDay.set(k, { asked: cur.asked + s.asked, correct: cur.correct + s.correct });
      }
      const series = keys.map((date) => {
        const { asked, correct } = byDay.get(date) ?? { asked: 0, correct: 0 };
        return { date, asked, correct, accuracy: ratio(correct, asked) };
      });
      const asked = list.reduce((n, s) => n + s.asked, 0);
      const correct = list.reduce((n, s) => n + s.correct, 0);
      return { algorithm, sessions: list.length, asked, correct, accuracy: ratio(correct, asked), series };
    })
    .sort((a, b) => b.asked - a.asked || a.algorithm.localeCompare(b.algorithm));

  const asked = byAlgorithm.reduce((n, a) => n + a.asked, 0);
  const correct = byAlgorithm.reduce((n, a) => n + a.correct, 0);

  const counts = new Map<MistakeKind, number>();
  for (const m of mistakes) {
    if (m.at > now || !inWindow.has(cal.key(m.at))) continue;
    counts.set(m.kind, (counts.get(m.kind) ?? 0) + 1);
  }
  const mistakesByKind = [...counts.entries()]
    .map(([kind, count]) => ({ kind, label: MISTAKE_LABELS[kind], count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    days: keys,
    sessions: graded.length,
    hasEnoughData: graded.length >= MIN_SESSIONS_FOR_PROGRESS,
    overall: { asked, correct, accuracy: ratio(correct, asked) },
    byAlgorithm,
    mistakesByKind,
  };
}
