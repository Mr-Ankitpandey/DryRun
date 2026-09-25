import type { ReviewItem } from '@/lib/storage';
import { INTERVAL_DAYS } from '@/learn/scheduler';
import { EmptyState } from '@/ui/EmptyState';
import { LinkButton } from './LinkButton';
import { nextDueSentence } from './review';
import { titleOf } from './titles';

export interface ReviewEmptyProps {
  review: Readonly<Record<string, ReviewItem>>;
  now: number;
}

const [firstDays, ...laterDays] = INTERVAL_DAYS;
const laterList = `${laterDays.slice(0, -1).join(', ')} and ${laterDays[laterDays.length - 1]}`;

/** Nothing due: say when the next one is, or invite the first trace. */
export function ReviewEmpty({ review, now }: ReviewEmptyProps) {
  const next = nextDueSentence(review, now, titleOf);
  if (Object.keys(review).length === 0 || next === null) {
    return (
      <EmptyState
        title="Nothing to re-trace yet"
        action={
          <LinkButton href="/algorithms" variant="primary">
            Choose an algorithm to trace
          </LinkButton>
        }
      >
        Trace an algorithm once and it comes back here on a fresh input after {firstDays === 1 ? '1 day' : `${firstDays} days`},
        then after {laterList} days while you keep getting it right.
      </EmptyState>
    );
  }
  return (
    <EmptyState title="Nothing due right now" action={<LinkButton href="/algorithms">Trace something new</LinkButton>}>
      {next} A re-trace works best once you have had time to forget, so come back then.
    </EmptyState>
  );
}
