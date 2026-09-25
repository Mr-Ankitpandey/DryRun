/** Landing hero data (docs/DESIGN.md §5, §6.1, §6.7). Pure: which input the
 *  hero traces, where "Keep tracing" goes, what the finish line says, and
 *  whether the returning learner sees the welcome block instead. */

import type { BinarySearchInput } from '@/algorithms/binary-search';
import { binarySearch } from '@/algorithms/binary-search';
import type { AlgorithmModule } from '@/algorithms/types';
import type { ReviewItem } from '@/lib/storage';
import { traceUrl } from '@/lib/url';
import { dueItems, estimateMinutes, welcomeLine } from '@/learn/scheduler';

export const HERO_SEED = 'hero';
export const HERO_MAX_ASKS = 2;
export const HERO_PRESET = 'basic';

/** The registry erases module input types; the hero does the same for TracePlayer. */
export const heroModule = binarySearch as unknown as AlgorithmModule<unknown>;

export function heroInput(): BinarySearchInput {
  const preset = binarySearch.presets.find((p) => p.id === HERO_PRESET);
  if (!preset) throw new Error(`binary search has no '${HERO_PRESET}' preset`);
  return preset.input;
}

/** Deep link into the full trace with the same input and seed: /t/binary-search?i=…&x=42&v=classic&seed=hero. */
export function keepTracingHref(input: BinarySearchInput = heroInput()): string {
  return traceUrl(binarySearch.meta.id, { ...binarySearch.encode(input), seed: HERO_SEED });
}

export interface HeroResult {
  asked: number;
  correct: number;
  /** Guided asks the full trace still has after the hero stopped. */
  remaining: number;
}

/** "Both right." / "1 of 2 right." plus what the full trace still holds. */
export function finishLine(r: HeroResult): string {
  const score = r.asked > 0 && r.correct === r.asked ? (r.asked === 2 ? 'Both right.' : `${r.asked} of ${r.asked} right.`) : `${r.correct} of ${r.asked} right.`;
  if (r.remaining <= 0) return `${score} That was the whole search.`;
  return `${score} The full trace has ${r.remaining} more question${r.remaining === 1 ? '' : 's'} before the search ends.`;
}

export interface Welcome {
  line: string;
  /** Titles of the due algorithms, earliest due first. */
  titles: string[];
}

/** The welcome block replaces the hero when at least one re-trace is due. */
export function welcomeFor(
  review: Readonly<Record<string, ReviewItem>>,
  now: number,
  catalog: readonly { id: string; title: string; minutes: number }[],
): Welcome | null {
  const due = dueItems(review, now);
  const minutesById: Record<string, number> = {};
  const titleById: Record<string, string> = {};
  for (const e of catalog) {
    minutesById[e.id] = e.minutes;
    titleById[e.id] = e.title;
  }
  const line = welcomeLine(due, estimateMinutes(due, minutesById));
  if (!line) return null;
  return { line, titles: due.map((d) => titleById[d.algorithm] ?? d.algorithm) };
}
