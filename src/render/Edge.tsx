/** A straight edge: BST parent links (keyed by child), recursion-tree links
 *  and graph edges (with the weight at the midpoint). Graph edge marks:
 *  relaxed = pen, tree = solid ink, rejected = dashed rule.
 *
 *  The line is never re-drawn by animating its x1/y1/x2/y2 attributes (DESIGN
 *  §3a: transforms only). It is a unit line centred on the origin, placed with
 *  translate(midpoint) rotate(angle) on the outer group and scaleX(length) on
 *  the inner one, with a non-scaling stroke. When a BST relink moves an edge,
 *  those three transforms travel on the move spring. */

import * as m from 'motion/react-m';
import { memo, useState } from 'react';
import type { FEdgePrim, GEdgePrim, TEdgePrim } from '@/engine/scene';
import { sameProps } from './memo';
import { useEnterInstant, useTransition } from './MotionMode';

type EdgePrim = TEdgePrim | FEdgePrim | GEdgePrim;

export interface EdgeGeometry {
  mx: number;
  my: number;
  angle: number;
  length: number;
}

/** Midpoint, angle (degrees) and length of a segment. `prevAngle` unwraps the
 *  angle so a relink turns the short way round instead of spinning. */
export function edgeGeometry(x1: number, y1: number, x2: number, y2: number, prevAngle: number | null = null): EdgeGeometry {
  let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  if (prevAngle !== null) {
    while (angle - prevAngle > 180) angle -= 360;
    while (angle - prevAngle < -180) angle += 360;
  }
  return { mx: (x1 + x2) / 2, my: (y1 + y2) / 2, angle, length: Math.hypot(x2 - x1, y2 - y1) };
}

export const Edge = memo(function Edge({ p }: { p: EdgePrim }) {
  const move = useTransition('move');
  const fade = useTransition('fade');
  const inst = useEnterInstant();
  const style = strokeFor(p);
  const [geo, setGeo] = useState(() => ({ key: `${p.x1},${p.y1},${p.x2},${p.y2}`, g: edgeGeometry(p.x1, p.y1, p.x2, p.y2) }));
  const key = `${p.x1},${p.y1},${p.x2},${p.y2}`;
  if (geo.key !== key) setGeo({ key, g: edgeGeometry(p.x1, p.y1, p.x2, p.y2, geo.g.angle) });
  const g = geo.key === key ? geo.g : edgeGeometry(p.x1, p.y1, p.x2, p.y2, geo.g.angle);
  return (
    <m.g data-id={p.id} initial={inst ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
      <m.g initial={false} animate={{ x: g.mx, y: g.my, rotate: g.angle }} transition={move}>
        <m.g initial={false} animate={{ scaleX: g.length }} transition={move}>
          <line x1={-0.5} y1={0} x2={0.5} y2={0} stroke={style.stroke} strokeWidth={style.width} strokeDasharray={style.dash} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
        </m.g>
      </m.g>
      {p.kind === 'gedge' && p.w !== null && (
        <g transform={`translate(${g.mx} ${g.my})`}>
          <rect x={-9} y={-8} width={18} height={16} rx={3} fill="var(--bg)" />
          <text y={4} textAnchor="middle" fontSize={11} fill={p.mark === 'rejected' ? 'var(--ink-2)' : 'var(--ink)'}>
            {p.w}
          </text>
        </g>
      )}
    </m.g>
  );
}, sameProps);

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
