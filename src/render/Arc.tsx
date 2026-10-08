/** A directed graph edge: a stroke from rim to rim (straight, or curved by
 *  the layout's `bend` so it clears other nodes) and a filled arrowhead at the
 *  target. Marks follow Edge: relaxed = pen, tree = solid ink, rejected =
 *  dashed rule (the dash is the non-colour cue; the head keeps the direction
 *  readable in every state). Graph topology is fixed, so an arc never moves;
 *  it only fades in once and changes style. */

import * as m from 'motion/react-m';
import { memo, useMemo } from 'react';
import type { GEdgePrim } from '@/engine/scene';
import { GRAPH_NODE_R } from '@/engine/layout/graph';
import { arcGeometry } from './arc-geometry';
import { badgeWidth, BADGE_H } from './edge-badges';
import { strokeFor } from './Edge';
import { sameProps } from './memo';
import { useEnterInstant, useTransition } from './MotionMode';

export const Arc = memo(function Arc({ p, badge }: { p: GEdgePrim; badge?: { x: number; y: number } }) {
  const fade = useTransition('fade');
  const inst = useEnterInstant();
  const style = strokeFor(p);
  const g = useMemo(() => arcGeometry(p, GRAPH_NODE_R), [p]);
  return (
    <m.g data-id={p.id} data-arc="true" initial={inst ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
      <path d={g.d} fill="none" stroke={style.stroke} strokeWidth={style.width} strokeDasharray={style.dash} strokeLinecap="butt" />
      <path d={g.head} fill={style.stroke} stroke="none" data-head={p.id} />
      {p.w !== null && (
        <g transform={`translate(${badge?.x ?? g.mid.x} ${badge?.y ?? g.mid.y})`} data-badge={p.id}>
          <rect x={-badgeWidth(p.w) / 2} y={-BADGE_H / 2} width={badgeWidth(p.w)} height={BADGE_H} rx={3} fill="var(--surface)" stroke="var(--rule)" strokeWidth={1} />
          <text y={4} textAnchor="middle" fontSize={11} fill={p.mark === 'rejected' ? 'var(--ink-2)' : 'var(--ink)'}>
            {p.w}
          </text>
        </g>
      )}
    </m.g>
  );
}, sameProps);
