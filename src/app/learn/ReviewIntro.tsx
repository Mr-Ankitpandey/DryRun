import type { ReviewItem } from '@/lib/storage';
import { estimateMinutes, welcomeLine } from '@/learn/scheduler';
import { Button } from '@/ui/Button';
import { timeAgo } from './format';
import { lede } from './styles';
import { MINUTES_BY_ID, titleOf } from './titles';

export interface ReviewIntroProps {
  due: readonly ReviewItem[];
  now: number;
  onStart: () => void;
}

/** "Welcome back — N re-traces due, ~M minutes.", the queue, and one button. */
export function ReviewIntro({ due, now, onStart }: ReviewIntroProps) {
  const first = due[0];
  return (
    <section aria-labelledby="review-welcome" className="max-w-2xl">
      {/* The span below keeps "re-trace" whole (a break at its hyphen reads as two words). Same colour, weight and
          face, so it is not an accent. avoid-ai-design-ignore: SD5 */}
      <h1 id="review-welcome" className="font-display text-3xl text-ink sm:text-4xl">
        {(welcomeLine(due, estimateMinutes(due, MINUTES_BY_ID)) ?? '').split(/(re-traces?)/).map((part, i) =>
          i % 2 === 1 ? (
            <span key={i} className="whitespace-nowrap">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </h1>
      <p className={lede}>Each re-trace uses a fresh input, so you work it out again instead of remembering the answer.</p>
      <ul aria-label="Due re-traces" className="mt-6 divide-y divide-rule border-y border-rule bg-surface">
        {due.map((it) => {
          const ago = timeAgo(it.due, now);
          return (
            <li key={it.algorithm} data-testid="due-item" className="flex max-w-none flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
              <span className="text-base font-medium text-ink">{titleOf(it.algorithm)}</span>
              <span className="text-sm text-ink-2">
                {it.reviews === 0 ? 'First re-trace' : `Last time ${Math.round(it.lastScore * 100)}% right`}, due{' '}
                {ago === 'just now' ? 'now' : ago}
              </span>
            </li>
          );
        })}
      </ul>
      {first ? (
        <div className="mt-6">
          <Button variant="primary" onClick={onStart}>
            Re-trace {titleOf(first.algorithm)}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
