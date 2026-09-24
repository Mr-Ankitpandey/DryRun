/** Leitner review scheduler (docs/ARCHITECTURE.md §8). One ReviewItem per
 *  algorithm; boxes 0–4 map to intervals of 1, 3, 7, 21 and 60 days. Pure. */

import { hashString } from '@/lib/rng';
import type { ReviewItem } from '@/lib/storage';

export type Box = ReviewItem['box'];

export const INTERVAL_DAYS: readonly number[] = [1, 3, 7, 21, 60];
export const DAY_MS = 24 * 60 * 60 * 1000;
/** A session at or above this score promotes the item one box. */
export const PASS_SCORE = 0.8;
export const MAX_BOX: Box = 4;
/** Minutes assumed for an algorithm the caller has no estimate for. */
export const DEFAULT_MINUTES = 3;

/** Milliseconds until the next review for a box. */
export function intervalMs(box: Box): number {
  return (INTERVAL_DAYS[box] as number) * DAY_MS;
}

/** First contact with an algorithm: box 0, due tomorrow, no reviews yet. */
export function enroll(algorithm: string, now: number): ReviewItem {
  return { algorithm, box: 0, due: now + intervalMs(0), reviews: 0, lastScore: 0 };
}

/** Applies a finished session: score ≥ 0.8 moves up one box (max 4), else back to box 0; due = now + interval. */
export function afterSession(item: ReviewItem | undefined, algorithm: string, score: number, now: number): ReviewItem {
  const prevBox: Box = item?.box ?? 0;
  const box: Box = score >= PASS_SCORE ? (Math.min(prevBox + 1, MAX_BOX) as Box) : 0;
  return { algorithm, box, due: now + intervalMs(box), reviews: (item?.reviews ?? 0) + 1, lastScore: score };
}

/** Items whose due time has passed, earliest due first (ties by algorithm id). */
export function dueItems(review: Readonly<Record<string, ReviewItem>>, now: number): ReviewItem[] {
  return Object.values(review)
    .filter((it) => it.due <= now)
    .sort((a, b) => a.due - b.due || a.algorithm.localeCompare(b.algorithm));
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Deterministic short seed for the n-th review of an algorithm: fresh each time, reproducible forever. */
export function reviewSeed(algorithm: string, reviews: number): string {
  let h = hashString(`review:${algorithm}:${reviews}`);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[h % ALPHABET.length];
    h = Math.floor(h / ALPHABET.length);
  }
  return out;
}

/** Sum of per-algorithm minute estimates for the given items (unknown ids count DEFAULT_MINUTES). */
export function estimateMinutes(items: readonly ReviewItem[], minutesById: Readonly<Record<string, number>>): number {
  return items.reduce((sum, it) => sum + (minutesById[it.algorithm] ?? DEFAULT_MINUTES), 0);
}

/** "Welcome back — 3 re-traces due, ~4 minutes." with singular forms; null when nothing is due. */
export function welcomeLine(items: readonly ReviewItem[], minutes: number): string | null {
  const n = items.length;
  if (n === 0) return null;
  const m = Math.max(1, Math.ceil(minutes));
  return `Welcome back — ${n} re-trace${n === 1 ? '' : 's'} due, ~${m} minute${m === 1 ? '' : 's'}.`;
}
