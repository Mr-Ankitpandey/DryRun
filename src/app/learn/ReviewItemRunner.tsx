import { useEffect, useRef, useState } from 'react';
import type { AlgorithmModule } from '@/algorithms/types';
import { findEntry } from '@/algorithms/registry';
import type { Level, MistakeRecord, ReviewItem } from '@/lib/storage';
import { reviewInput } from '@/learn/review-input';
import { targetSentence } from '@/learn/targets';
import type { MistakeKind } from '@/trace/asks';
import type { Session } from '@/trace/session';
import { Button } from '@/ui/Button';
import { TracePlayer } from '../trace/TracePlayer';

export interface ReviewItemRunnerProps {
  item: ReviewItem;
  level: Level;
  /** Mistakes as they were when the review started (a snapshot, so the input
   *  does not change when this re-trace records new mistakes). */
  mistakes: readonly MistakeRecord[];
  /** When the review started; "recent" mistakes are counted back from here. */
  now: number;
  onFinish: (session: Session) => void;
}

type Loaded =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; module: AlgorithmModule<unknown>; input: unknown; seed: string; target: MistakeKind | null };

/** Loads one due algorithm, builds its fresh review input from the review seed,
 *  aimed at the learner's weakest recent kind of mistake when an input can
 *  exercise it, and runs it in the trace player. The player persists the
 *  session, which reschedules the item; this component only reports the finish. */
export function ReviewItemRunner({ item, level, mistakes, now, onFinish }: ReviewItemRunnerProps) {
  const entry = findEntry(item.algorithm);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; value: Loaded }>({ attempt: 0, value: { status: 'loading' } });
  const finished = useRef(false);

  useEffect(() => {
    if (!entry) return;
    let live = true;
    entry
      .load()
      .then((module) => {
        if (!live) return;
        const r = reviewInput(module, item.algorithm, item, mistakes, now);
        setLoaded({ attempt, value: { status: 'ready', module, ...r } });
      })
      .catch(() => {
        if (live) setLoaded({ attempt, value: { status: 'error' } });
      });
    return () => {
      live = false;
    };
  }, [entry, item, mistakes, now, attempt]);

  const title = entry?.title ?? item.algorithm;
  const state: Loaded = loaded.attempt === attempt ? loaded.value : { status: 'loading' };

  if (!entry || state.status === 'error') {
    return (
      <div role="alert" className="flex max-w-prose flex-col items-start gap-3 py-4">
        <p className="text-base text-ink">
          {entry
            ? `${title} could not be loaded. Check your connection, then try again.`
            : `This review item points to an algorithm this version of DryRun does not have (${item.algorithm}). Skip it for now.`}
        </p>
        {entry ? <Button onClick={() => setAttempt((n) => n + 1)}>Try loading again</Button> : null}
      </div>
    );
  }
  if (state.status === 'loading') {
    return (
      <p className="py-4 text-base text-ink-2" aria-busy="true">
        Preparing a fresh input for {title}…
      </p>
    );
  }
  const why = state.target ? targetSentence(item.algorithm, state.target) : null;
  return (
    <>
      {why ? (
        <p data-testid="review-target" className="mb-4 max-w-prose text-base text-ink-2">
          {why}
        </p>
      ) : null}
      <TracePlayer
        module={state.module}
        input={state.input}
        seed={state.seed}
        mode="trace"
        level={level}
        variant="full"
        persist
        onFinish={(session) => {
          if (finished.current) return;
          finished.current = true;
          onFinish(session);
        }}
      />
    </>
  );
}
