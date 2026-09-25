/** An order ask: tap the items in sequence to build the order (no dragging).
 *  The pool is offered sorted by label so its layout gives nothing away; a
 *  used item stays in place, struck, so the pool never reflows under the
 *  finger. Undo (Backspace) takes back the last one; Submit (Enter) is
 *  enabled once every item is placed. */

import * as m from 'motion/react-m';
import type { Id } from '@/engine/events';
import { Button } from '@/ui/Button';
import { Kbd } from '@/ui/Kbd';
import { UndoIcon } from '@/render/icons';
import { useTransition } from '@/render/MotionMode';

export interface AskOrderProps {
  pool: readonly Id[];
  seq: readonly Id[];
  label: (id: Id) => string;
  onAdd: (id: Id) => void;
  onUndo: () => void;
  onClear: () => void;
  onSubmit: () => void;
}

export function AskOrder({ pool, seq, label, onAdd, onUndo, onClear, onSubmit }: AskOrderProps) {
  const press = useTransition('sheet');
  const complete = seq.length === pool.length;
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Your order" className="m-0 flex min-h-11 list-none flex-wrap items-center gap-1.5 rounded-sm border border-dashed border-rule p-1.5" data-testid="order-seq">
        {seq.length === 0 && <li className="px-1.5 text-sm text-ink-2">Tap the items in order.</li>}
        {seq.map((id, i) => (
          <li key={id} className="flex items-center gap-1.5 font-mono text-base">
            {i > 0 && (
              <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 text-ink-2" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M2 6 H10 M7 3 L10 6 L7 9" />
              </svg>
            )}
            <span className="rounded-xs bg-hatch px-2 py-1">{label(id)}</span>
          </li>
        ))}
      </ol>
      <div role="group" aria-label="Items" className="flex flex-wrap gap-2">
        {pool.map((id, i) => {
          const used = seq.includes(id);
          return (
            <m.button
              key={id}
              type="button"
              data-item={id}
              disabled={used}
              aria-pressed={used}
              whileTap={{ scale: 0.96 }}
              transition={press}
              onClick={() => onAdd(id)}
              className="inline-flex h-11 min-w-11 items-center gap-2 rounded-sm border border-rule bg-surface px-3 font-mono text-base text-ink transition-colors duration-(--dur-xs) hover:border-ink disabled:border-grid disabled:text-ink-2 disabled:line-through"
            >
              {i < 9 && <Kbd>{i + 1}</Kbd>}
              {label(id)}
            </m.button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onSubmit} disabled={!complete} data-testid="order-submit">
          Check order
        </Button>
        <Button onClick={onUndo} disabled={seq.length === 0} icon={<UndoIcon />}>
          Undo
        </Button>
        <Button variant="quiet" onClick={onClear} disabled={seq.length === 0}>
          Clear
        </Button>
      </div>
    </div>
  );
}
