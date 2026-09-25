/** A transient connector. 'compare': amber bracket between two positioned
 *  prims with a `?`/result badge; when one side has no position (a variable),
 *  the badge sits above the positioned side and names the other. 'dep': a
 *  dashed ink-2 line from a dependency into the fresh cell. */

import * as m from 'motion/react-m';
import type { LinkPrim, Scene } from '@/engine/scene';
import { positionOf } from '@/engine/scene';
import { useInstant, useTransition } from './MotionMode';

export function Link({ p, scene }: { p: LinkPrim; scene: Scene }) {
  const fade = useTransition('fade');
  const inst = useInstant();
  const a = positionOf(scene, p.from);
  const b = positionOf(scene, p.to);
  if (!a && !b) return null;
  const common = { 'data-id': p.id, 'data-style': p.style, initial: inst ? false : { opacity: 0 }, animate: { opacity: 1 }, transition: fade } as const;

  if (p.style === 'dep') {
    if (!a || !b) return null;
    const ax = a.x;
    const ay = a.y + a.h / 2;
    const bx = b.x;
    const by = b.y + b.h / 2;
    return (
      <m.g {...common} pointerEvents="none">
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="3 3" />
        <circle cx={ax} cy={ay} r={3} fill="var(--ink-2)" />
      </m.g>
    );
  }

  const badge = p.result ?? '?';
  if (a && b) {
    const top = Math.min(a.y, b.y) - 16;
    const mx = (a.x + b.x) / 2;
    const near = Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;
    return (
      <m.g {...common} pointerEvents="none">
        {!near && <path d={`M${a.x} ${a.y - 4} V${top} H${b.x} V${b.y - 4}`} fill="none" stroke="var(--amber)" strokeWidth={1.5} />}
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
