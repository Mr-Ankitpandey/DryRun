/** A straight edge whose endpoints animate: BST parent links (keyed by child),
 *  recursion-tree links and graph edges (with the weight at the midpoint).
 *  Graph edge marks: relaxed = pen, tree = solid ink, rejected = dashed rule. */

import { motion } from 'motion/react';
import type { FEdgePrim, GEdgePrim, TEdgePrim } from '@/engine/scene';
import { useInstant, useTransition } from './MotionMode';

type EdgePrim = TEdgePrim | FEdgePrim | GEdgePrim;

export function Edge({ p }: { p: EdgePrim }) {
  const move = useTransition('move');
  const fade = useTransition('fade');
  const inst = useInstant();
  const style = strokeFor(p);
  const mx = (p.x1 + p.x2) / 2;
  const my = (p.y1 + p.y2) / 2;
  const ends = { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 };
  return (
    <motion.g data-id={p.id} initial={inst ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
      <motion.line initial={inst ? false : ends} animate={ends} transition={move} stroke={style.stroke} strokeWidth={style.width} strokeDasharray={style.dash} strokeLinecap="round" />
      {p.kind === 'gedge' && p.w !== null && (
        <motion.g initial={inst ? false : { x: mx, y: my }} animate={{ x: mx, y: my }} transition={move}>
          <rect x={-9} y={-8} width={18} height={16} rx={3} fill="var(--bg)" />
          <text y={4} textAnchor="middle" fontSize={11} fill={p.mark === 'rejected' ? 'var(--ink-2)' : 'var(--ink)'}>
            {p.w}
          </text>
        </motion.g>
      )}
    </motion.g>
  );
}

function strokeFor(p: EdgePrim): { stroke: string; width: number; dash: string | undefined } {
  if (p.kind !== 'gedge') return { stroke: p.kind === 'fedge' ? 'var(--rule)' : 'var(--ink-2)', width: 1.25, dash: undefined };
  switch (p.mark) {
    case 'relaxed':
      return { stroke: 'var(--pen)', width: 2, dash: undefined };
    case 'tree':
      return { stroke: 'var(--ink)', width: 2.5, dash: undefined };
    case 'rejected':
      return { stroke: 'var(--rule)', width: 1.25, dash: '4 4' };
    case null:
      return { stroke: 'var(--rule)', width: 1.5, dash: undefined };
  }
}
