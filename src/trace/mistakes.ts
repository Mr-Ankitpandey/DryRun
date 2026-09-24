/** Mistake bank aggregation (docs/DESIGN.md §5 "Mistake bank"): groups stored
 *  MistakeRecords by kind and by algorithm, and builds re-trace links. Pure. */

import type { MistakeRecord } from '@/lib/storage';
import { parseQuery, traceUrl } from '@/lib/url';
import type { Level, MistakeKind } from './asks';
import { MISTAKE_LABELS } from './asks';

export interface MistakeOccurrence {
  id: string;
  algorithm: string;
  seed: string;
  input: string;
  askIndex: number;
  at: number;
  rule: string;
}

export interface MistakeKindGroup {
  kind: MistakeKind;
  label: string;
  count: number;
  lastSeen: number;
  /** Rule sentence of the most recent occurrence. */
  rule: string;
  /** Newest first. */
  occurrences: MistakeOccurrence[];
}

export interface AlgorithmMistakes {
  algorithm: string;
  count: number;
  lastSeen: number;
  /** Count per kind, most frequent first. */
  kinds: { kind: MistakeKind; label: string; count: number }[];
}

export interface MistakeBank {
  total: number;
  /** Most frequent kind first; ties by label. */
  byKind: MistakeKindGroup[];
  /** Most mistakes first; ties by algorithm id. */
  byAlgorithm: AlgorithmMistakes[];
}

const byAtDesc = (a: { at: number }, b: { at: number }) => b.at - a.at;

/** Kind counts sorted by count desc, then label. */
function kindCounts(records: readonly MistakeRecord[]): { kind: MistakeKind; label: string; count: number }[] {
  const counts = new Map<MistakeKind, number>();
  for (const r of records) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, label: MISTAKE_LABELS[kind], count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Aggregates mistake records into the view the Mistake bank screen renders. */
export function mistakeBank(records: readonly MistakeRecord[]): MistakeBank {
  const byKindMap = new Map<MistakeKind, MistakeRecord[]>();
  const byAlgMap = new Map<string, MistakeRecord[]>();
  for (const r of records) {
    byKindMap.set(r.kind, [...(byKindMap.get(r.kind) ?? []), r]);
    byAlgMap.set(r.algorithm, [...(byAlgMap.get(r.algorithm) ?? []), r]);
  }
  const byKind: MistakeKindGroup[] = [...byKindMap.entries()]
    .map(([kind, list]) => {
      const sorted = [...list].sort(byAtDesc);
      const newest = sorted[0] as MistakeRecord;
      return {
        kind,
        label: MISTAKE_LABELS[kind],
        count: sorted.length,
        lastSeen: newest.at,
        rule: newest.rule,
        occurrences: sorted.map(({ id, algorithm, seed, input, askIndex, at, rule }) => ({ id, algorithm, seed, input, askIndex, at, rule })),
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const byAlgorithm: AlgorithmMistakes[] = [...byAlgMap.entries()]
    .map(([algorithm, list]) => ({
      algorithm,
      count: list.length,
      lastSeen: Math.max(...list.map((r) => r.at)),
      kinds: kindCounts(list),
    }))
    .sort((a, b) => b.count - a.count || a.algorithm.localeCompare(b.algorithm));
  return { total: records.length, byKind, byAlgorithm };
}

/** Link that reopens the exact trace of a mistake: same input params, same seed, trace mode. */
export function retraceUrl(record: Pick<MistakeRecord, 'algorithm' | 'input' | 'seed'>, level?: Level): string {
  const params: Record<string, string | undefined> = { ...parseQuery(record.input), seed: record.seed, mode: 'trace', level };
  return traceUrl(record.algorithm, params);
}
