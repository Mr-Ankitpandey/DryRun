/** Mistake bank display model: within one kind, occurrences from the same trace
 *  (same algorithm, seed and input) collapse into one row with one re-trace
 *  link, newest trace first. Pure. */

import type { MistakeOccurrence } from '@/trace/mistakes';

export interface TraceRow {
  /** Stable key: algorithm + seed + input. */
  key: string;
  algorithm: string;
  seed: string;
  input: string;
  /** Mistakes of this kind in this trace. */
  count: number;
  /** Most recent mistake of this kind in this trace. */
  lastAt: number;
}

/** Groups occurrences by trace; rows sorted newest first (ties by key). */
export function traceRows(occurrences: readonly MistakeOccurrence[]): TraceRow[] {
  const rows = new Map<string, TraceRow>();
  for (const o of occurrences) {
    const key = `${o.algorithm}|${o.seed}|${o.input}`;
    const cur = rows.get(key);
    if (cur) {
      cur.count += 1;
      cur.lastAt = Math.max(cur.lastAt, o.at);
    } else {
      rows.set(key, { key, algorithm: o.algorithm, seed: o.seed, input: o.input, count: 1, lastAt: o.at });
    }
  }
  return [...rows.values()].sort((a, b) => b.lastAt - a.lastAt || a.key.localeCompare(b.key));
}

/** Distinct algorithm ids in a kind's occurrences, most mistakes first (ties by id). */
export function algorithmsOf(occurrences: readonly MistakeOccurrence[]): string[] {
  const counts = new Map<string, number>();
  for (const o of occurrences) counts.set(o.algorithm, (counts.get(o.algorithm) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id);
}
