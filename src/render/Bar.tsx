/** An array element: a bar whose height follows its value, with the value in
 *  mono. Cues: mark styles (marks.ts), amber stroke while compared, dotted
 *  outline while read, 50 % opacity inside an eliminated region. */

import type { BarPrim } from '@/engine/scene';
import { LINKED_STROKE, PATTERN, TICK_PATH, markStyle } from './marks';
import { PrimGroup } from './PrimGroup';

export function Bar({ p, dim = false }: { p: BarPrim; dim?: boolean }) {
  const s = markStyle(p.mark);
  const stroke = p.compared ? 'var(--amber)' : s.stroke;
  const strokeWidth = p.compared ? 2 : s.strokeWidth;
  const inner = p.w - 4;
  return (
    <PrimGroup id={p.id} x={p.x} y={p.y} opacity={dim ? 0.5 : 1} kind="move">
      {(linked) => (
        <>
          <rect x={2} width={inner} height={p.h} rx={2} fill={s.fill} fillOpacity={s.fillOpacity} stroke={linked ? LINKED_STROKE : stroke} strokeWidth={linked ? 2.5 : strokeWidth} strokeDasharray={s.dash} />
          {s.dots && <rect x={2} width={inner} height={p.h} rx={2} fill={`url(#${PATTERN.dots})`} />}
          {p.read && <rect x={-1} y={-3} width={p.w + 2} height={p.h + 6} rx={3} fill="none" stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="1.5 3" />}
          {s.tick && <path d={TICK_PATH} transform={`translate(${p.w - 15} 4)`} fill="none" stroke={s.textFill} strokeWidth={1.5} />}
          <text x={p.w / 2} y={p.h - 7} textAnchor="middle" fontSize={14} fill={s.textFill}>
            {p.value}
          </text>
          {p.skipped && (
            <text x={p.w / 2} y={-6} textAnchor="middle" fontSize={9} fill="var(--ink-2)">
              skip
            </text>
          )}
        </>
      )}
    </PrimGroup>
  );
}
