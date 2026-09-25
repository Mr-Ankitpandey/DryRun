/** The loop under the hero: predict, reveal, re-trace later. It is a real
 *  sequence, so it is an ordered list, but it carries no decorative numerals:
 *  the verbs are the headings and the stills show the states in order. Each
 *  still sits in the same right-hand column as the live trace above it and, on
 *  a desktop, the three join into one continuous strip with the verbs in the
 *  margin: worked states written down one page of a notebook. */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { INTERVAL_DAYS } from '@/learn/scheduler';
import { landingStills } from './stills';
import type { Still } from './stills';
import { StillFigure } from './StillFigure';

/** base.css caps `li` at 70ch (unlayered, so a Tailwind utility cannot undo it);
 *  these rows are layout, not prose. */
const LI_FULL = { maxWidth: 'none' } as const;

function Row({ title, children, still, caption, testId }: { title: string; children: ReactNode; still: Still; caption: ReactNode; testId: string }) {
  return (
    <li style={LI_FULL} className="group/row grid gap-x-10 gap-y-4 border-t border-rule pt-6 lg:grid-cols-[5fr_7fr] lg:border-t-0 lg:pt-0" data-testid={testId}>
      <div className="lg:border-t lg:border-rule lg:pt-5 lg:pb-8">
        <h3 className="font-display text-xl">{title}</h3>
        <p className="mt-2 max-w-[44ch] text-base text-ink">{children}</p>
      </div>
      <figure className="m-0 min-w-0 border border-rule bg-surface lg:border-b-0 lg:group-last/row:border-b">
        <div className="px-3 pt-3 sm:px-4">
          <StillFigure scene={still.scene} layout={still.layout} label={still.label} ghost={still.ghost} />
        </div>
        <figcaption className="border-t border-rule px-3 py-3 text-sm sm:px-4">{caption}</figcaption>
      </figure>
    </li>
  );
}

export function LoopRows() {
  const s = useMemo(() => landingStills(), []);
  const [, first, second, third] = INTERVAL_DAYS;
  return (
    <ol className="mt-6 flex list-none flex-col gap-10 p-0 lg:gap-0">
      <Row title="Predict" still={s.predict} caption={<span className="text-ink">{s.predict.caption}</span>} testId="loop-predict">
        The trace stops before each move that matters and asks what happens next. You answer on the array itself: tap the cell, then see if you were right.
      </Row>
      <Row
        title="Reveal"
        still={s.reveal}
        testId="loop-reveal"
        caption={
          <>
            <span className="font-medium text-red">{s.reveal.kind}.</span> <span className="text-ink">{s.reveal.caption}</span>
          </>
        }
      >
        The real move plays. A wrong guess stays on the grid in red pencil next to the truth, with the one rule it broke, and goes into your mistake bank by kind.
      </Row>
      <Row
        title="Re-trace later"
        still={s.retrace}
        testId="loop-retrace"
        caption={
          <span className="text-ink">
            New numbers, same question: <span className="text-ink">{s.retrace.caption}</span>
          </span>
        }
      >
        The next day the algorithm comes back on numbers you have not seen. Each clean re-trace pushes the next one further out: {first}, {second}, then {third} days.
      </Row>
    </ol>
  );
}
