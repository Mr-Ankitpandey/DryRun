/** Review and practice inputs aimed at the learner's weak spot. A re-trace still
 *  uses the review seed (fresh each time, reproducible forever); what changes is
 *  the `randomInput` target, picked from the kind of mistake the learner made
 *  most often lately on that algorithm. Pure. */

import type { AlgorithmModule } from '@/algorithms/types';
import { createRng } from '@/lib/rng';
import type { Level, MistakeRecord, ReviewItem } from '@/lib/storage';
import { traceUrl } from '@/lib/url';
import type { MistakeKind } from '@/trace/asks';
import { DAY_MS, reviewSeed } from './scheduler';
import { targetFor } from './targets';

/** Days of mistakes that count as "recent". */
export const WEAK_SPOT_DAYS = 30;

/** The most frequent MistakeKind for `algorithm` in the last `windowDays` days
 *  (ties → the kind seen most recently, then by kind id), or null when there is
 *  none. `only` limits the kinds considered (e.g. those with a target). */
export function weakestKind(
  mistakes: readonly MistakeRecord[],
  algorithm: string,
  now: number,
  windowDays = WEAK_SPOT_DAYS,
  only?: (kind: MistakeKind) => boolean,
): MistakeKind | null {
  const since = now - windowDays * DAY_MS;
  const stats = new Map<MistakeKind, { count: number; last: number }>();
  for (const m of mistakes) {
    if (m.algorithm !== algorithm || m.at < since) continue;
    if (only && !only(m.kind)) continue;
    const cur = stats.get(m.kind);
    stats.set(m.kind, cur ? { count: cur.count + 1, last: Math.max(cur.last, m.at) } : { count: 1, last: m.at });
  }
  let best: { kind: MistakeKind; count: number; last: number } | null = null;
  for (const [kind, s] of stats) {
    if (!best || s.count > best.count || (s.count === best.count && (s.last > best.last || (s.last === best.last && kind < best.kind)))) {
      best = { kind, ...s };
    }
  }
  return best?.kind ?? null;
}

export interface ReviewInput<I> {
  input: I;
  seed: string;
  /** The kind the input targets, or null for a plain random input. */
  target: MistakeKind | null;
}

type InputSource<I> = Pick<AlgorithmModule<I>, 'randomInput'>;

/** The input for a due re-trace: seeded by `reviewSeed(algorithm, item.reviews)`,
 *  aimed at the weakest recent kind that has a target for this algorithm (kinds
 *  with no helpful input, such as 'unclassified', are passed over). With no such
 *  kind it is exactly the untargeted review input. */
export function reviewInput<I>(
  module: InputSource<I>,
  algorithm: string,
  item: Pick<ReviewItem, 'reviews'>,
  mistakes: readonly MistakeRecord[],
  now: number,
): ReviewInput<I> {
  const seed = reviewSeed(algorithm, item.reviews);
  const kind = weakestKind(mistakes, algorithm, now, WEAK_SPOT_DAYS, (k) => targetFor(algorithm, k) !== null);
  const entry = kind ? targetFor(algorithm, kind) : null;
  const rng = createRng(seed);
  if (!kind || !entry) return { input: module.randomInput(rng), seed, target: null };
  return { input: module.randomInput(rng, entry.target), seed, target: kind };
}

/** A fresh practice trace for one kind of mistake: a new input from the kind's
 *  target, seeded by `seed` (which also becomes the session seed). Null when the
 *  kind has no target for this algorithm. */
export function practiceUrl<I>(
  module: Pick<AlgorithmModule<I>, 'randomInput' | 'encode'>,
  algorithm: string,
  kind: MistakeKind,
  seed: string,
  level?: Level,
): string | null {
  const entry = targetFor(algorithm, kind);
  if (!entry) return null;
  const input = module.randomInput(createRng(seed), entry.target);
  return traceUrl(algorithm, { ...module.encode(input), seed, mode: 'trace', level });
}
