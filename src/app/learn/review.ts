/** Review session view model: the queue snapshot, per-item result lines and the
 *  end-of-session summary. Pure; the screen owns React state and the player. */

import type { ReviewItem } from '@/lib/storage';
import type { MistakeKind } from '@/trace/asks';
import type { Session } from '@/trace/session';
import { askedCount, correctCount } from '@/trace/session';
import { plural, timeUntil } from './format';

/** Short noun for a mistake kind inside a sentence ("1 stale-entry mistake"). */
export const KIND_NOUN: Record<MistakeKind, string> = {
  boundary: 'boundary',
  comparison: 'comparison',
  order: 'order',
  stale: 'stale-entry',
  'base-case': 'base-case',
  subtree: 'subtree',
  'shift-vs-swap': 'shift-vs-swap',
  dependency: 'dependency',
  unclassified: 'unclassified',
};

export interface ItemResult {
  algorithm: string;
  title: string;
  asked: number;
  correct: number;
  /** Mistake counts by kind, most frequent first (ties by kind id). */
  mistakes: { kind: MistakeKind; count: number }[];
}

/** Counts from a finished session. */
export function itemResult(session: Session, title: string): ItemResult {
  const counts = new Map<MistakeKind, number>();
  for (const a of session.answers) {
    if (a.result.correct) continue;
    const kind = a.result.kind ?? 'unclassified';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const mistakes = [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
  return { algorithm: session.meta.algorithm, title, asked: askedCount(session), correct: correctCount(session), mistakes };
}

/** "a", "a and b", "a, b and c". */
function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** "Dijkstra: 7 of 8 right, 1 stale-entry mistake." */
export function resultLine(r: ItemResult): string {
  if (r.asked === 0) return `${r.title}: finished, nothing was asked at this level.`;
  const head = `${r.title}: ${r.correct} of ${r.asked} right`;
  if (r.mistakes.length === 0) return `${head}, no mistakes.`;
  const parts = r.mistakes.map((m) => `${m.count} ${KIND_NOUN[m.kind]}`);
  const total = r.mistakes.reduce((n, m) => n + m.count, 0);
  return `${head}, ${joinAnd(parts)} mistake${total === 1 ? '' : 's'}.`;
}

/** "2 re-traces, 13 of 16 right." */
export function totalsLine(results: readonly ItemResult[]): string {
  const asked = results.reduce((n, r) => n + r.asked, 0);
  const correct = results.reduce((n, r) => n + r.correct, 0);
  const head = plural(results.length, 're-trace');
  return asked === 0 ? `${head}, nothing was asked.` : `${head}, ${correct} of ${asked} right.`;
}

/** The earliest item that is not due yet, or null when there is none. */
export function nextUpcoming(review: Readonly<Record<string, ReviewItem>>, now: number): ReviewItem | null {
  let best: ReviewItem | null = null;
  for (const it of Object.values(review)) {
    if (it.due <= now) continue;
    if (!best || it.due < best.due || (it.due === best.due && it.algorithm < best.algorithm)) best = it;
  }
  return best;
}

/** "Your next re-trace is Dijkstra, due tomorrow." or null when nothing is scheduled. */
export function nextDueSentence(
  review: Readonly<Record<string, ReviewItem>>,
  now: number,
  titleOf: (id: string) => string,
): string | null {
  const next = nextUpcoming(review, now);
  if (!next) return null;
  return `Your next re-trace is ${titleOf(next.algorithm)}, due ${timeUntil(next.due, now)}.`;
}
