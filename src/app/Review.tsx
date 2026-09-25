/** Review `/review` (docs/DESIGN.md §5, §6.7): the due re-traces, one after the
 *  other, each on a fresh seeded input. The trace player persists every session,
 *  which reschedules the item; this screen keeps a snapshot of the queue it
 *  started with, so items do not reshuffle mid-review. */

import { useMemo, useState } from 'react';
import { findEntry } from '@/algorithms/registry';
import type { ReviewItem } from '@/lib/storage';
import { dueItems } from '@/learn/scheduler';
import { AppShell } from '@/ui/AppShell';
import { Button } from '@/ui/Button';
import { ProgressBar } from '@/ui/ProgressBar';
import { TopBar } from '@/ui/TopBar';
import { useStore } from '@/ui/store';
import { SiteNav } from './SiteNav';
import { LinkButton } from './learn/LinkButton';
import { RecoveredNotice } from './learn/RecoveredNotice';
import { ReviewEmpty } from './learn/ReviewEmpty';
import { ReviewIntro } from './learn/ReviewIntro';
import { ReviewItemRunner } from './learn/ReviewItemRunner';
import { ReviewResults } from './learn/ReviewResults';
import type { ItemResult } from './learn/review';
import { itemResult, nextDueSentence, resultLine, totalsLine } from './learn/review';
import { lede, screenTitle } from './learn/styles';
import { titleOf } from './learn/titles';

type Phase = { name: 'intro' } | { name: 'running'; index: number } | { name: 'between'; index: number } | { name: 'done'; at: number };

export default function Review() {
  const { store } = useStore();
  const [now] = useState(() => Date.now());
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [phase, setPhase] = useState<Phase>({ name: 'intro' });
  const [results, setResults] = useState<ItemResult[]>([]);

  // Only algorithms this build knows can be re-traced.
  const due = useMemo(() => dueItems(store.review, now).filter((it) => findEntry(it.algorithm)), [store.review, now]);

  function start() {
    setQueue(due);
    setResults([]);
    setPhase({ name: 'running', index: 0 });
  }

  function finishItem(index: number) {
    setPhase(index + 1 < queue.length ? { name: 'between', index } : { name: 'done', at: Date.now() });
  }

  let body;
  if (phase.name === 'intro') {
    body = due.length > 0 ? <ReviewIntro due={due} now={now} onStart={start} /> : <ReviewEmpty review={store.review} now={now} />;
  } else if (phase.name === 'running') {
    const item = queue[phase.index];
    body = item ? (
      <section aria-labelledby="review-current">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-ink-2">
              Re-trace {phase.index + 1} of {queue.length}
            </p>
            <h1 id="review-current" className={screenTitle}>
              {titleOf(item.algorithm)}
            </h1>
          </div>
          <Button size="sm" onClick={() => finishItem(phase.index)}>
            Skip this one
          </Button>
        </div>
        <ProgressBar className="mt-3 max-w-md" value={phase.index} max={queue.length} label="Re-traces finished" />
        <div className="mt-6">
          <ReviewItemRunner
            key={`${item.algorithm}:${item.reviews}`}
            item={item}
            level={store.settings.level}
            onFinish={(session) => {
              setResults((rs) => [...rs, itemResult(session, titleOf(item.algorithm))]);
              finishItem(phase.index);
            }}
          />
        </div>
      </section>
    ) : null;
  } else if (phase.name === 'between') {
    const next = queue[phase.index + 1];
    const last = results[results.length - 1];
    const justSkipped = results.length === 0 || last?.algorithm !== queue[phase.index]?.algorithm;
    body = (
      <section aria-labelledby="review-between" className="max-w-2xl">
        <p className="text-sm text-ink-2">
          {phase.index + 1} of {queue.length} done
        </p>
        <h1 id="review-between" className={screenTitle}>
          {!justSkipped && last ? resultLine(last) : `Skipped ${titleOf(queue[phase.index]?.algorithm ?? '')}. It stays due.`}
        </h1>
        {next ? <p className={lede}>Next up: {titleOf(next.algorithm)}, on a fresh input.</p> : null}
        <div className="mt-5">
          <Button variant="primary" onClick={() => setPhase({ name: 'running', index: phase.index + 1 })}>
            Next re-trace
          </Button>
        </div>
        {results.length > (justSkipped ? 0 : 1) ? (
          <ReviewResults results={justSkipped ? results : results.slice(0, -1)} heading="Earlier in this review" />
        ) : null}
      </section>
    );
  } else {
    const upcoming = nextDueSentence(store.review, phase.at, titleOf);
    body = (
      <section aria-labelledby="review-done" className="max-w-2xl">
        <h1 id="review-done" className={screenTitle}>
          Review done
        </h1>
        <p className={lede}>
          {results.length > 0 ? totalsLine(results) : 'You skipped every re-trace, so they stay due.'}
          {upcoming ? ` ${upcoming}` : ''}
        </p>
        {results.length > 0 ? <ReviewResults results={results} heading="This review" /> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/" variant="primary">
            Back to home
          </LinkButton>
          <LinkButton href="/mistakes">See your mistakes</LinkButton>
        </div>
      </section>
    );
  }

  return (
    <AppShell topBar={<TopBar title="Review" end={<SiteNav />} />}>
      <RecoveredNotice />
      {body}
    </AppShell>
  );
}
