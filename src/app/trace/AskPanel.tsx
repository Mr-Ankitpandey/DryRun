/** The open question: its prompt (crossfades in when it changes) and the
 *  control for its kind. Pick answers are given on the stage itself; the panel
 *  only says how. With ?debug=1 in the URL the panel exposes the expected
 *  answer as data-answer-hint for the end-to-end tests; never otherwise. */

import * as m from 'motion/react-m';
import type { Id } from '@/engine/events';
import type { Ask } from '@/trace/asks';
import { useEnterInstant, useTransition } from '@/render/MotionMode';
import { AskChoice } from './asks/AskChoice';
import { AskOrder } from './asks/AskOrder';
import { AskValue } from './asks/AskValue';

export interface AskPanelProps {
  ask: Ask;
  askIndex: number;
  /** Pick targets or order pool, in key order. */
  order: readonly Id[];
  hintCount: number;
  onAnswer: (a: Id | number | string) => void;
  seq: readonly Id[];
  label: (id: Id) => string;
  onOrderAdd: (id: Id) => void;
  onOrderUndo: () => void;
  onOrderClear: () => void;
  onOrderSubmit: () => void;
  debug: boolean;
  desktop: boolean;
  /** What a pick is made on: "element" (arrays), "node" (trees, graphs), "cell" (grids). */
  pickNoun: string;
}

function answerHint(ask: Ask): string {
  if (Array.isArray(ask.answer)) return ask.answer.join(',');
  return String(ask.answer);
}

export function AskPanel(p: AskPanelProps) {
  const fade = useTransition('mark');
  const enterInstant = useEnterInstant();
  const { ask } = p;
  return (
    <div data-testid="ask" data-kind={ask.kind} data-ask-index={p.askIndex} data-answer-hint={p.debug ? answerHint(ask) : undefined} className="flex flex-col gap-3">
      <m.p key={`${p.askIndex}`} initial={enterInstant ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fade} className="m-0 text-xl leading-snug font-medium text-ink" data-testid="prompt">
        {ask.prompt}
      </m.p>
      {ask.kind === 'pick' && (
        <p className="m-0 text-sm text-ink-2">
          {p.desktop ? 'Click' : 'Tap'} {p.pickNoun === 'element' ? 'an element' : `a ${p.pickNoun}`} on the stage
          {p.hintCount > 0 ? `, or press 1–${p.hintCount}` : ''}
          {p.order.length > p.hintCount ? ' (Tab reaches the rest)' : ''}.
        </p>
      )}
      {ask.kind === 'choice' && <AskChoice options={ask.options} onAnswer={p.onAnswer} />}
      {ask.kind === 'value' && <AskValue ask={ask} onAnswer={p.onAnswer} autoFocus={p.desktop} />}
      {ask.kind === 'order' && (
        <AskOrder pool={p.order} seq={p.seq} label={p.label} onAdd={p.onOrderAdd} onUndo={p.onOrderUndo} onClear={p.onOrderClear} onSubmit={p.onOrderSubmit} />
      )}
    </div>
  );
}
