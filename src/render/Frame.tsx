/** A call frame in the recursion tree: a pill as wide as its segment, aligned
 *  under the array. Active = pen tint and ring; open = ink; returned = rule
 *  stroke, ink-2 text and a tick with the returned value when there is one. */

import { memo } from 'react';
import type { FramePrim } from '@/engine/scene';
import { formatScalar } from '@/engine/scene';
import { frameLabel } from './labels';
import { LINKED_STROKE, TICK_PATH } from './marks';
import { sameProps } from './memo';
import { PrimGroup } from './PrimGroup';

export const Frame = memo(function Frame({ p }: { p: FramePrim }) {
  const stroke = p.active ? 'var(--pen)' : p.open ? 'var(--ink)' : 'var(--rule)';
  const text = p.returned ? 'var(--ink-2)' : 'var(--ink)';
  return (
    <PrimGroup id={p.id} x={p.x} y={p.y} kind="settle">
      {(linked) => (
        <>
          <rect x={-p.w / 2} y={-p.h / 2} width={p.w} height={p.h} rx={p.h / 2} fill={p.active ? 'var(--pen)' : 'var(--surface)'} fillOpacity={p.active ? 0.14 : 1} stroke={linked ? LINKED_STROKE : stroke} strokeWidth={linked || p.active ? 2 : 1} />
          <text y={4} textAnchor="middle" fontSize={11} fill={text}>
            {frameLabel(p.label, p.w, 11, p.returned && p.value !== null ? ` → ${formatScalar(p.value)}` : '')}
          </text>
          {p.returned && <path d={TICK_PATH} transform={`translate(${p.w / 2 - 14} ${-p.h / 2 + 3}) scale(0.7)`} fill="none" stroke="var(--ink-2)" strokeWidth={1.5} />}
        </>
      )}
    </PrimGroup>
  );
}, sameProps);
