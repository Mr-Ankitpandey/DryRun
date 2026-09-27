/** Blind level, question area while the reveal runs: the answer is locked in,
 *  the hidden steps play at 2×, then the verdict shows. One button (focused,
 *  so Enter or Space works) jumps straight to the verdict. */

import { useEffect, useRef } from 'react';
import { Button } from '@/ui/Button';
import { Kbd } from '@/ui/Kbd';

export function BlindReveal({ done, total, onSkip }: { done: number; total: number; onSkip: () => void }) {
  const actions = useRef<HTMLDivElement>(null);
  useEffect(() => {
    actions.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);
  return (
    <div data-testid="blind-reveal" className="flex flex-col gap-3">
      <p className="m-0 text-base text-ink" role="status">
        Answer locked in. The hidden steps play now, then the verdict.
      </p>
      <p className="m-0 font-mono text-sm text-ink-2 tabular-nums" data-testid="blind-reveal-count">
        {done} of {total} steps
      </p>
      <div ref={actions} className="flex items-center gap-3">
        <Button onClick={onSkip} data-testid="reveal-skip">
          Skip to the verdict
        </Button>
        <span className="hidden text-sm text-ink-2 sm:inline">
          or <Kbd>Enter</Kbd>
        </span>
      </div>
    </div>
  );
}

/** The hidden-steps sentence where no narration line can carry it. */
export function BlindHiddenNote({ note }: { note: string }) {
  return (
    <p data-testid="blind-hidden" className="m-0 text-sm text-ink-2">
      {note}
    </p>
  );
}
