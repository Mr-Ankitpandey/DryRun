/** Shared list body for stack / queue / pq / call-stack panels. Rows are keyed
 *  by item id and absolutely placed at `order × row height`, so when the order
 *  changes (a PQ push lands in the middle) the rows travel on the move spring
 *  with transforms only; text snaps. A row fades in when it enters and leaves
 *  at once: no AnimatePresence, because an exit still running when stepping
 *  back re-adds the same key is how Motion 13 strands rows at opacity 0.
 *  Stale rows are struck through with a "stale" tag; hovering a row links the
 *  prim it stands for (`ref`). */

import * as m from 'motion/react-m';
import type { RowPrim } from '@/engine/scene';
import { useHoverHandlers, useLinked } from './HoverProvider';
import { useEnterInstant, useTransition } from './MotionMode';

/** Row pitch in CSS px (28 px rows: dense, still legible at 14 px mono). */
export const ROW_H = 28;

export interface PanelListProps {
  title: string;
  rows: RowPrim[];
  /** Caption for the first row ("top", "front") and the last ("bottom", "back"). */
  ends?: [string, string];
  empty?: string;
  showKey?: boolean;
  testId?: string;
}

export function PanelList({ title, rows, ends, empty = 'empty', showKey = false, testId }: PanelListProps) {
  return (
    <section data-testid={testId} data-panel={title} className="min-w-0 font-mono text-sm">
      <h3 className="mb-1 font-sans text-sm font-medium text-ink-2">{title}</h3>
      <ul className="relative m-0 list-none overflow-hidden rounded-sm border border-rule bg-surface p-0" style={{ height: Math.max(1, rows.length) * ROW_H + 2 }}>
        {rows.map((r, i) => (
          <PanelRow key={r.id} row={r} order={i} showKey={showKey} caption={ends ? (i === 0 ? ends[0] : i === rows.length - 1 ? ends[1] : null) : null} />
        ))}
        {rows.length === 0 && <li className="px-2 leading-7 text-ink-2">{empty}</li>}
      </ul>
    </section>
  );
}

function PanelRow({ row, order, showKey, caption }: { row: RowPrim; order: number; showKey: boolean; caption: string | null }) {
  const linked = useLinked(row.id, row.ref);
  const handlers = useHoverHandlers(row.ref ?? row.id);
  const move = useTransition('move');
  const fade = useTransition('fade');
  const inst = useEnterInstant();
  const y = order * ROW_H;
  return (
    <m.li
      data-id={row.id}
      data-ref={row.ref ?? undefined}
      data-linked={linked ? 'true' : undefined}
      data-stale={row.stale ? 'true' : undefined}
      initial={inst ? false : { y, opacity: 0 }}
      animate={{ y, opacity: 1 }}
      transition={{ y: move, opacity: fade }}
      {...handlers}
      className={
        'absolute inset-x-0 top-0 flex items-baseline gap-2 border-b border-grid px-2 leading-7 ' +
        (linked ? 'bg-hatch ' : '') +
        (row.stale ? 'text-ink-2 line-through' : 'text-ink')
      }
      style={{ height: ROW_H }}
    >
      {showKey && row.key !== null && <span className="min-w-[2ch] text-right text-ink-2">{row.key}</span>}
      <span className="truncate">{row.label}</span>
      {row.text !== null && <span className="truncate text-ink-2">{row.text}</span>}
      <span className="ml-auto shrink-0 font-sans text-xs text-ink-2 no-underline">{row.stale ? 'stale' : caption}</span>
    </m.li>
  );
}
