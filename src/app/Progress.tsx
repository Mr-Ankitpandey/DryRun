/** Progress `/progress` (docs/DESIGN.md §5): one honest chart, prediction
 *  accuracy per algorithm over the last 30 days as small multiples on a shared
 *  0–100 % scale, and mistakes by kind as a bar list. No XP, streaks or badges.
 *  With fewer than 3 graded sessions it says so instead of drawing a chart. */

import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { MIN_SESSIONS_FOR_PROGRESS, PROGRESS_DAYS, localCalendar, progress } from '@/learn/progress';
import { AppShell } from '@/ui/AppShell';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';
import { useStore } from '@/ui/store';
import { SiteNav } from './SiteNav';
import { AccuracyPanel } from './learn/AccuracyPanel';
import { AccuracyTable } from './learn/AccuracyTable';
import { LinkButton } from './learn/LinkButton';
import { MistakeBars } from './learn/MistakeBars';
import { RecoveredNotice } from './learn/RecoveredNotice';
import { percent, plural } from './learn/format';
import { lede, screenTitle, sectionTitle, textLink } from './learn/styles';
import { byRegistryOrder, titleOf } from './learn/titles';

export default function Progress() {
  const { store } = useStore();
  const [now] = useState(() => Date.now());
  const p = useMemo(() => progress(store.sessions, store.mistakes, now, { calendar: localCalendar }), [store.sessions, store.mistakes, now]);
  const overall = percent(p.overall.correct, p.overall.asked);
  // Same place every visit: registry order, not "most asked first".
  const panels = useMemo(() => [...p.byAlgorithm].sort((x, y) => byRegistryOrder(x.algorithm, y.algorithm)), [p.byAlgorithm]);

  return (
    <AppShell topBar={<TopBar title="Progress" end={<SiteNav />} />}>
      <RecoveredNotice />
      <h1 className={screenTitle}>Progress</h1>
      {!p.hasEnoughData ? (
        <EmptyState
          className="mt-2"
          title="Not enough traces for a trend yet"
          action={
            <LinkButton href="/algorithms" variant="primary">
              Choose an algorithm to trace
            </LinkButton>
          }
        >
          Progress shows how often your predictions were right, per algorithm, over the last {PROGRESS_DAYS} days. It needs at
          least {MIN_SESSIONS_FOR_PROGRESS} traced sessions in that time; you have {p.sessions}.
        </EmptyState>
      ) : (
        <>
          <p className={lede}>
            Last {PROGRESS_DAYS} days: {p.overall.correct} of {p.overall.asked} predictions right ({overall}%) across{' '}
            {plural(p.sessions, 'session')}.
          </p>

          <section aria-labelledby="accuracy-h" className="mt-8">
            <h2 id="accuracy-h" className={sectionTitle}>
              Prediction accuracy by algorithm
            </h2>
            <p className="mt-1 max-w-prose text-sm text-ink-2">
              Share of answers you got right each day, same 0 to 100% scale in every panel. Days without a trace are left
              blank, not counted as zero.
            </p>
            <div className="mt-4 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {panels.map((a) => (
                <AccuracyPanel key={a.algorithm} title={titleOf(a.algorithm)} series={a.series} asked={a.asked} correct={a.correct} />
              ))}
            </div>
            <AccuracyTable rows={panels} titleOf={titleOf} />
          </section>

          <section aria-labelledby="kinds-h" className="mt-10">
            <h2 id="kinds-h" className={sectionTitle}>
              Mistakes by kind
            </h2>
            {p.mistakesByKind.length === 0 ? (
              <p className="mt-1 max-w-prose text-base text-ink-2">No mistakes in the last {PROGRESS_DAYS} days.</p>
            ) : (
              <>
                <p className="mt-1 mb-4 max-w-prose text-sm text-ink-2">
                  Wrong predictions in the last {PROGRESS_DAYS} days, by the rule that was missed.{' '}
                  <Link href="/mistakes" className={textLink}>
                    Open the mistake bank
                  </Link>{' '}
                  to re-trace them.
                </p>
                <MistakeBars kinds={p.mistakesByKind} />
              </>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
