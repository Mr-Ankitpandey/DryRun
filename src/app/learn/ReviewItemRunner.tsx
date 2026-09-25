import { useEffect, useRef, useState } from 'react';
import type { AlgorithmModule } from '@/algorithms/types';
import { findEntry } from '@/algorithms/registry';
import { createRng } from '@/lib/rng';
import type { Level, ReviewItem } from '@/lib/storage';
import { reviewSeed } from '@/learn/scheduler';
import type { Session } from '@/trace/session';
import { Button } from '@/ui/Button';
import { TracePlayer } from '../trace/TracePlayer';

export interface ReviewItemRunnerProps {
  item: ReviewItem;
  level: Level;
  onFinish: (session: Session) => void;
}

type Loaded = { status: 'loading' } | { status: 'error' } | { status: 'ready'; module: AlgorithmModule<unknown>; input: unknown; seed: string };

/** Loads one due algorithm, builds its fresh review input from the review seed
 *  and runs it in the trace player. The player persists the session, which
 *  reschedules the item; this component only reports the finish upward. */
export function ReviewItemRunner({ item, level, onFinish }: ReviewItemRunnerProps) {
  const entry = findEntry(item.algorithm);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; value: Loaded }>({ attempt: 0, value: { status: 'loading' } });
  const finished = useRef(false);

  useEffect(() => {
    if (!entry) return;
    let live = true;
    const seed = reviewSeed(item.algorithm, item.reviews);
    entry
      .load()
      .then((module) => {
        if (!live) return;
        const input = module.randomInput(createRng(seed));
        setLoaded({ attempt, value: { status: 'ready', module, input, seed } });
      })
      .catch(() => {
        if (live) setLoaded({ attempt, value: { status: 'error' } });
      });
    return () => {
      live = false;
    };
  }, [entry, item.algorithm, item.reviews, attempt]);

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
  return (
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
  );
}
