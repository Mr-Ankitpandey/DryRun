/** Library table rows (docs/DESIGN.md §5 "Library"): registry metadata joined
 *  with the learner's own record. Pure, so the honest-empty rules are tested:
 *  no graded answers means accuracy is null ("—"), never 0 %. */

import type { Family } from '@/algorithms/types';
import type { ReviewItem, SessionRecord } from '@/lib/storage';
import { DAY_MS } from '@/learn/scheduler';

export interface LibraryEntry {
  id: string;
  title: string;
  family: Family;
  practice: string;
  minutes: number;
}

export type ReviewStatus = { kind: 'none' } | { kind: 'due' } | { kind: 'later'; days: number };

export interface LibraryRow extends LibraryEntry {
  href: string;
  /** Graded answers across every stored session of this algorithm. */
  asked: number;
  correct: number;
  /** correct / asked, or null when nothing has been graded yet. */
  accuracy: number | null;
  review: ReviewStatus;
}

export const FAMILY_LABELS: Record<Family, string> = {
  search: 'Search',
  sort: 'Sorting',
  tree: 'Trees',
  graph: 'Graphs',
  dp: 'Dynamic programming',
};

/** Families in a fixed teaching order, limited to the ones the registry has. */
export function familiesIn(entries: readonly LibraryEntry[]): Family[] {
  const order: Family[] = ['search', 'sort', 'tree', 'graph', 'dp'];
  const present = new Set(entries.map((e) => e.family));
  return order.filter((f) => present.has(f));
}

export function reviewStatus(item: ReviewItem | undefined, now: number): ReviewStatus {
  if (!item) return { kind: 'none' };
  if (item.due <= now) return { kind: 'due' };
  return { kind: 'later', days: Math.max(1, Math.ceil((item.due - now) / DAY_MS)) };
}

export function libraryRows(
  entries: readonly LibraryEntry[],
  sessions: readonly SessionRecord[],
  review: Readonly<Record<string, ReviewItem>>,
  now: number,
): LibraryRow[] {
  const totals = new Map<string, { asked: number; correct: number }>();
  for (const s of sessions) {
    if (s.asked <= 0) continue; // watch sessions are not graded
    const t = totals.get(s.algorithm) ?? { asked: 0, correct: 0 };
    totals.set(s.algorithm, { asked: t.asked + s.asked, correct: t.correct + Math.min(s.correct, s.asked) });
  }
  return entries.map((e) => {
    const t = totals.get(e.id) ?? { asked: 0, correct: 0 };
    return {
      id: e.id,
      title: e.title,
      family: e.family,
      practice: e.practice,
      minutes: e.minutes,
      href: `/t/${e.id}`,
      asked: t.asked,
      correct: t.correct,
      accuracy: t.asked === 0 ? null : t.correct / t.asked,
      review: reviewStatus(review[e.id], now),
    };
  });
}

/** "83%" or "—" (never "0%" for an algorithm that was never traced). */
export function formatAccuracy(accuracy: number | null): string {
  return accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`;
}

export function formatReview(status: ReviewStatus): string {
  switch (status.kind) {
    case 'none':
      return '—';
    case 'due':
      return 'Due now';
    case 'later':
      return status.days === 1 ? 'In 1 day' : `In ${status.days} days`;
  }
}
