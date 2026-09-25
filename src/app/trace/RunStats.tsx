/** "This run" (DESIGN §1 wireframe, right column): questions answered, how
 *  many were right, and the mistakes so far by kind. */

import type { Session } from '@/trace/session';
import { correctCount } from '@/trace/session';
import { ProgressBar } from '@/ui/ProgressBar';
import { mistakesByKind } from './logic';

export function RunStats({ session, total }: { session: Session; total: number }) {
  const asked = session.answers.length;
  const right = correctCount(session);
  const groups = mistakesByKind(session);
  return (
    <section aria-label="This run" data-testid="run-stats" className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-medium text-ink-2">This run</h3>
      <ProgressBar value={asked} max={total} label="Questions answered" />
      <p className="m-0 text-base text-ink">{asked === 0 ? 'No answers yet.' : `${right} right, ${asked - right} wrong.`}</p>
      {groups.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-ink">
          {groups.map((g) => (
            <li key={g.kind} className="flex items-baseline gap-2">
              <span className="font-mono text-red">{g.count}×</span>
              <span>{g.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
