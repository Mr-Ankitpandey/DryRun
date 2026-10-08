/** A transient connector. 'compare': amber bracket between two positioned
 *  prims with a `?`/result badge; when one side has no position (a variable),
 *  the badge sits above the positioned side and names the other. 'dep': a
 *  dashed ink-2 line from a dependency into the fresh cell. Between two
 *  circles (graph or tree nodes) the bracket leaves from the top of each rim,
 *  not from the centre, so it never runs through a node's label or value. */

import * as m from 'motion/react-m';
import type { LinkPrim, Scene } from '@/engine/scene';
import { positionOf } from '@/engine/scene';
import { GRAPH_NODE_R } from '@/engine/layout/graph';
import { TREE_NODE_R } from '@/engine/layout/tree';
import { useInstant, useTransition } from './MotionMode';
import { TNODE_TEXT_H } from './labels';

export function Link({ p, scene }: { p: LinkPrim; scene: Scene }) {
  const fade = useTransition('fade');
  const inst = useInstant();
  const a = positionOf(scene, p.from);
  const b = positionOf(scene, p.to);
  const rimOf = (id: string) => {
    const prim = scene.prims.get(id);
    if (prim?.kind === 'gnode') return GRAPH_NODE_R;
    // A labelled tree node carries its text above the circle: start above it.
    if (prim?.kind === 'tnode') return TREE_NODE_R + (prim.text !== undefined ? TNODE_TEXT_H : 0);
    return 0;
  };
  if (!a && !b) return null;
  const common = { 'data-id': p.id, 'data-style': p.style, initial: inst ? false : { opacity: 0 }, animate: { opacity: 1 }, transition: fade } as const;

  if (p.style === 'dep') {
    if (!a || !b) return null;
    // From the edge of the dependency cell to the edge of the fresh cell, so
    // the dot and the dashes never sit on either cell's value.
    const acx = a.x;
    const acy = a.y + a.h / 2;
    const bcx = b.x;
    const bcy = b.y + b.h / 2;
    const dx = bcx - acx;
    const dy = bcy - acy;
    const exit = (w: number, h: number) => {
      const tx = dx === 0 ? Infinity : w / 2 / Math.abs(dx);
      const ty = dy === 0 ? Infinity : h / 2 / Math.abs(dy);
      return Math.min(tx, ty);
    };
    const ta = exit(a.w, a.h);
    const tb = exit(b.w, b.h);
    const ax = acx + dx * (Number.isFinite(ta) ? ta : 0);
    const ay = acy + dy * (Number.isFinite(ta) ? ta : 0);
    const bx = bcx - dx * (Number.isFinite(tb) ? tb : 0);
    const by = bcy - dy * (Number.isFinite(tb) ? tb : 0);
    return (
      <m.g {...common} pointerEvents="none">
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="3 3" />
        <circle cx={ax} cy={ay} r={3} fill="var(--ink-2)" />
      </m.g>
    );
  }

  const badge = p.result ?? '?';
  if (a && b) {
    const ra = rimOf(p.from);
    const rb = rimOf(p.to);
    const ay = ra ? a.y - ra - 2 : a.y - 4;
    const by = rb ? b.y - rb - 2 : b.y - 4;
    const top = Math.min(ay, by) - (ra || rb ? 10 : 12);
    const mx = (a.x + b.x) / 2;
    const near = Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;
    return (
      <m.g {...common} pointerEvents="none">
        {!near && <path d={`M${a.x} ${ay} V${top} H${b.x} V${by}`} fill="none" stroke="var(--amber)" strokeWidth={1.5} />}
        <Badge x={mx} y={top} text={badge} />
      </m.g>
    );
  }
  const anchor = (a ?? b) as { x: number; y: number };
  const other = a ? p.to : p.from;
  const name = other.startsWith('v:') ? other.slice(2) : other;
  return (
    <m.g {...common} pointerEvents="none">
      <path d={`M${anchor.x} ${anchor.y - 4} V${anchor.y - 16}`} stroke="var(--amber)" strokeWidth={1.5} />
      <Badge x={anchor.x} y={anchor.y - 22} text={`${badge} ${name}`} wide />
    </m.g>
  );
}

function Badge({ x, y, text, wide = false }: { x: number; y: number; text: string; wide?: boolean }) {
  const w = wide ? 12 + text.length * 7 : 18;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-9} width={w} height={18} rx={9} fill="var(--surface)" stroke="var(--amber)" strokeWidth={1.5} />
      <text y={4} textAnchor="middle" fontSize={11} fill="var(--amber)">
        {text}
      </text>
    </g>
  );
}
