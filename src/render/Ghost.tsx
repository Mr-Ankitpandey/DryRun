/** The learner's wrong guess (DESIGN §3a.4, §6.2): a red-pencil sketch at the
 *  guessed element or slot. The dashed outline sketches itself in (a mask
 *  whose stroke draws with pathLength, so the dashes appear along the pen's
 *  path instead of fading), then stays at 40 % until the next ask. The × badge
 *  is the non-colour cue. When the guess was a node, the ghost follows it on
 *  the move spring. */

import * as m from 'motion/react-m';
import { useId } from 'react';
import type { Outline } from './outline';
import { outlineCorner, outlinePath } from './outline';
import { useInstant, useTransition } from './MotionMode';

export function Ghost({ outline, label }: { outline: Outline; label?: string }) {
  const sketch = useTransition('sketch');
  const move = useTransition('move');
  const inst = useInstant();
  const maskId = `ghost-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const d = outlinePath(outline);
  const corner = outlineCorner(outline);
  return (
    <m.g data-testid="ghost" aria-hidden="true" pointerEvents="none" initial={false} animate={{ x: outline.cx, y: outline.cy }} transition={move}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x={-1000} y={-1000} width={2000} height={2000}>
        <m.path d={d} fill="none" stroke="#fff" strokeWidth={10} initial={inst ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={sketch} />
      </mask>
      <g opacity={0.4}>
        <path d={d} fill="var(--red)" fillOpacity={0.12} stroke="none" />
      </g>
      <path d={d} fill="none" stroke="var(--red)" strokeOpacity={0.9} strokeWidth={2.5} strokeDasharray="6 4" strokeLinecap="round" mask={`url(#${maskId})`} opacity={0.55} />
      <g transform={`translate(${corner.x} ${corner.y})`}>
        <circle r={8} fill="var(--red)" />
        <path d="M-3 -3 L3 3 M3 -3 L-3 3" stroke="var(--surface)" strokeWidth={1.75} strokeLinecap="round" />
      </g>
      {label && (
        <text x={0} y={(outline.shape === 'circle' ? outline.r : outline.h / 2) + 14} textAnchor="middle" fontSize={10} fill="var(--red)">
          {label}
        </text>
      )}
    </m.g>
  );
}
