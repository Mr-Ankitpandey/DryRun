/** The verdict after an answer (DESIGN §6.2). Right: a green tick draws itself
 *  and the step's note says what happened. Wrong: the rule sentence replaces
 *  the prompt, under the learner's answer struck in red pencil and the real one
 *  in ink; the mistake kind is named. Continue (Enter or Space) plays on. */

import * as m from 'motion/react-m';
import { useEffect, useRef } from 'react';
import { MISTAKE_LABELS } from '@/trace/asks';
import { Button } from '@/ui/Button';
import { Kbd } from '@/ui/Kbd';
import { TICK_PATH } from '@/render/marks';
import { useInstant, useTransition } from '@/render/MotionMode';
import { answerText } from './logic';
import type { Verdict } from './useTraceController';

export interface VerdictPanelProps {
  verdict: Verdict;
  /** What happened in the answered step (shown when the screen has no narration line). */
  note: string | null;
  /** Label of the Continue button, or null for none. */
  action: string | null;
  busy: boolean;
  onContinue: () => void;
}

export function VerdictPanel({ verdict, note, action, busy, onContinue }: VerdictPanelProps) {
  const draw = useTransition('draw');
  const inst = useInstant();
  const actions = useRef<HTMLDivElement>(null);
  const { result, ask, given, askedScene } = verdict;
  useEffect(() => {
    if (!verdict.ack) actions.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [verdict]);
  return (
    <div data-testid="verdict" data-correct={result.correct ? 'true' : 'false'} role="status" aria-live="polite" className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${result.correct ? 'bg-green' : 'bg-red'}`}>
          <svg viewBox="-2 -2 14 12" className="size-4" fill="none" stroke="var(--surface)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {result.correct ? (
              <m.path d={TICK_PATH} initial={inst ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={draw} />
            ) : (
              <path d="M1 0 L9 8 M9 0 L1 8" />
            )}
          </svg>
        </span>
        <p className="m-0 text-xl leading-snug font-medium text-ink">{result.correct ? 'Right.' : 'Not quite.'}</p>
        {!result.correct && result.kind && <span className="ml-auto text-sm text-ink-2">{MISTAKE_LABELS[result.kind]}</span>}
      </div>
      {result.correct ? (
        <p className="m-0 text-base text-ink">
          It is <strong className="font-mono font-semibold">{answerText(ask, given, askedScene)}</strong>.{note ? <span className="text-ink-2"> {note}</span> : null}
        </p>
      ) : (
        <>
          <p className="m-0 text-base text-ink">
            You said <s className="font-mono text-red decoration-2">{answerText(ask, given, askedScene)}</s>; it is <strong className="font-mono font-semibold">{answerText(ask, result.expected, askedScene)}</strong>.
          </p>
          <p data-testid="rule" className="m-0 text-lg leading-snug text-ink">
            <span className="block text-sm text-ink-2">The rule</span>
            {result.rule}
          </p>
          {note && <p className="m-0 text-sm text-ink-2">{note}</p>}
        </>
      )}
      {action && (
        <div ref={actions} className="flex items-center gap-3">
          <Button variant="primary" onClick={onContinue} disabled={busy} data-testid="continue">
            {action}
          </Button>
          <span className="hidden text-sm text-ink-2 sm:inline">
            or <Kbd>Enter</Kbd>
          </span>
        </div>
      )}
    </div>
  );
}
