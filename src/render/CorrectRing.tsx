/** Confirmation on the stage (DESIGN §3a.3). `correct`: a green ring draws
 *  itself around the right answer (pathLength 0 → 1) and settles once (scale
 *  1.04 → 1 on the sheet spring), with a ✓ badge drawn as a path. `truth`: the
 *  same ring in pen, around the real answer after a wrong guess ("the truth is
 *  drawn in pen"). */

import * as m from 'motion/react-m';
import type { Outline } from './outline';
import { outlineCorner, outlinePath } from './outline';
import { TICK_PATH } from './marks';
import { useInstant, useTransition } from './MotionMode';

export function CorrectRing({ outline, tone = 'correct' }: { outline: Outline; tone?: 'correct' | 'truth' }) {
  const draw = useTransition('draw');
  const settle = useTransition('sheet');
  const move = useTransition('move');
  const inst = useInstant();
  const color = tone === 'correct' ? 'var(--green)' : 'var(--pen)';
  const corner = outlineCorner(outline);
  return (
    <m.g data-testid={tone === 'correct' ? 'correct-ring' : 'truth-ring'} aria-hidden="true" pointerEvents="none" initial={false} animate={{ x: outline.cx, y: outline.cy }} transition={move}>
      <m.g initial={inst ? false : { scale: 1.04 }} animate={{ scale: 1 }} transition={settle}>
        <m.path d={outlinePath(outline)} fill="none" stroke={color} strokeWidth={2} initial={inst ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={draw} />
        {tone === 'correct' && (
          <g transform={`translate(${corner.x} ${corner.y})`}>
            <circle r={8} fill={color} />
            <path d={TICK_PATH} transform="translate(-4.5 -3.5) scale(0.9)" fill="none" stroke="var(--surface)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </m.g>
    </m.g>
  );
}
