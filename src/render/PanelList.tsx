/** Shared list body for stack / queue / pq / call-stack panels: rows keyed by
 *  item id, enter with a fade, leave at once (no AnimatePresence: Motion 13
 *  strands exited HTML children at opacity 0 when a list empties and refills
 *  under rapid stepping; see .scratch/wp-a/probe5.mjs), text snaps. Stale rows
 *  are struck through with a "stale" tag; hovering a row links the prim it
 *  stands for (`ref`). */

import { motion } from 'motion/react';
import type { RowPrim } from '@/engine/scene';
import { useHoverHandlers, useLinked } from './HoverProvider';
import { useInstant, useTransition } from './MotionMode';

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
    <section data-testid={testId} data-panel={title} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--rule)', borderRadius: 4, background: 'var(--surface)', minHeight: 28 }}>
        {rows.map((r, i) => (
          <PanelRow key={r.id} row={r} showKey={showKey} caption={ends ? (i === 0 ? ends[0] : i === rows.length - 1 ? ends[1] : null) : null} />
        ))}
        {rows.length === 0 && <li style={{ padding: '4px 8px', color: 'var(--ink-2)' }}>{empty}</li>}
      </ul>
    </section>
  );
}

function PanelRow({ row, showKey, caption }: { row: RowPrim; showKey: boolean; caption: string | null }) {
  const linked = useLinked(row.id, row.ref);
  const handlers = useHoverHandlers(row.ref ?? row.id);
  const fade = useTransition('fade');
  const inst = useInstant();
  return (
    <motion.li
      data-id={row.id}
      data-ref={row.ref ?? undefined}
      data-linked={linked ? 'true' : undefined}
      data-stale={row.stale ? 'true' : undefined}
      initial={inst ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fade}
      {...handlers}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '4px 8px',
        borderBottom: '1px solid var(--grid)',
        background: linked ? 'color-mix(in srgb, var(--pen) 12%, transparent)' : 'transparent',
        color: row.stale ? 'var(--ink-2)' : 'var(--ink)',
        textDecoration: row.stale ? 'line-through' : 'none',
      }}
    >
      {showKey && row.key !== null && <span style={{ minWidth: '2ch', textAlign: 'right', color: 'var(--ink-2)' }}>{row.key}</span>}
      <span>{row.label}</span>
      {row.text !== null && <span style={{ color: 'var(--ink-2)' }}>{row.text}</span>}
      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-2)', fontFamily: 'var(--font-ui)' }}>{row.stale ? 'stale' : caption}</span>
    </motion.li>
  );
}
