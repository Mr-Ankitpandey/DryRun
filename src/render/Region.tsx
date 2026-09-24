/** An invariant region over a run of array slots: 45° hatch with its kind as a
 *  bracket label above; 'eliminated' uses cross-hatch. Always mounted once
 *  declared so it grows and shrinks continuously (x and width animate; this is
 *  the one place DESIGN §3 allows a width animation). */

import { motion } from 'motion/react';
import type { RegionPrim } from '@/engine/scene';
import { PATTERN } from './marks';
import { useInstant, useTransition } from './MotionMode';
import { instant } from './springs';

export function Region({ p }: { p: RegionPrim }) {
  const move = useTransition('region');
  const fade = useTransition('fade');
  const inst = useInstant();
  // Width snaps to 0 while the region fades out (never a negative width).
  const rectT = p.visible ? move : { ...move, width: instant };
  const pattern = p.kind2 === 'eliminated' ? PATTERN.cross : PATTERN.hatch;
  return (
    <motion.g data-id={p.id} data-kind={p.kind2} initial={false} animate={{ opacity: p.visible ? 1 : 0 }} transition={fade}>
      <motion.rect y={p.y} height={p.h} rx={3} initial={inst ? false : { x: p.x, width: p.w }} animate={{ x: p.x, width: p.w }} transition={rectT} fill={`url(#${pattern})`} stroke="var(--rule)" strokeWidth={1} strokeDasharray="3 2" />
      <motion.g initial={false} animate={{ x: p.x }} transition={move}>
        <path d={`M0 ${p.y - 3} v-5 h${Math.max(0, Math.min(p.w, 14))}`} fill="none" stroke="var(--ink-2)" strokeWidth={1} />
        <text x={4} y={p.y - 10} fontSize={10} fill="var(--ink-2)">
          {p.kind2}
        </text>
      </motion.g>
    </motion.g>
  );
}
