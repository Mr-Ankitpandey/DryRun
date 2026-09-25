/** A DP grid cell: empty until computed; the fresh cell (being computed now)
 *  gets a pen ring and tint, read cells a dotted outline, done a tick. */

import { memo } from 'react';
import type { CellPrim } from '@/engine/scene';
import { LINKED_STROKE, TICK_PATH, markStyle } from './marks';
import { sameProps } from './memo';
import { PrimGroup } from './PrimGroup';

export const Cell = memo(function Cell({ p }: { p: CellPrim }) {
  const s = markStyle(p.mark);
  const empty = p.value === null;
  return (
    <PrimGroup id={p.id} x={p.x} y={p.y} kind="settle">
      {(linked) => (
        <>
          <rect x={1} y={1} width={p.w - 2} height={p.h - 2} rx={2} fill={empty ? 'none' : s.fill} fillOpacity={s.fillOpacity} stroke={linked ? LINKED_STROKE : empty ? 'var(--grid)' : s.stroke} strokeWidth={linked ? 2.5 : s.strokeWidth} strokeDasharray={s.dash} />
          {p.read && <rect x={-2} y={-2} width={p.w + 4} height={p.h + 4} rx={3} fill="none" stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="1.5 3" />}
          {s.tick && <path d={TICK_PATH} transform={`translate(${p.w - 14} 4) scale(0.8)`} fill="none" stroke={s.textFill} strokeWidth={1.5} />}
          {!empty && (
            <text x={p.w / 2} y={p.h / 2 + 5} textAnchor="middle" fontSize={13} fill={s.textFill}>
              {p.value}
            </text>
          )}
        </>
      )}
    </PrimGroup>
  );
}, sameProps);
