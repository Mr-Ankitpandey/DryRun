/** The step's one-sentence note. The phase, when the step has one, is a quiet
 *  lead-in in the same sentence case.
 *
 *  Screen readers hear the note once the step settles, not on every step a
 *  scrub or a run of key presses flies past: the visible line is not a live
 *  region; a visually hidden copy is, and it is only updated after the note
 *  has stayed the same for SETTLE_MS and the timeline is not being dragged. */

import { useEffect, useState } from 'react';

export const SETTLE_MS = 350;

export interface NarrationProps {
  note: string;
  phase?: string | undefined;
  /** True while the timeline is being scrubbed: say nothing until it stops. */
  quiet?: boolean;
  className?: string;
}

export function Narration({ note, phase, quiet = false, className = '' }: NarrationProps) {
  const text = phase ? `${phase}: ${note}` : note;
  const [spoken, setSpoken] = useState(text);
  useEffect(() => {
    if (quiet) return;
    const id = window.setTimeout(() => setSpoken(text), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [text, quiet]);
  return (
    <>
      <p data-testid="narration" className={`m-0 min-h-[3em] text-base leading-normal text-ink ${className}`}>
        {phase && <span className="mr-2 text-sm text-ink-2">{phase}:</span>}
        {note}
      </p>
      <span className="sr-only" aria-live="polite" aria-atomic="true" data-testid="narration-live">
        {spoken}
      </span>
    </>
  );
}
