/** A graph node: circle with its label and, below, its text (e.g. the current
 *  distance). Frontier = dashed teal ring, visited = dotted fill, settled =
 *  solid ink + tick; a skipped node shows a small "stale" tag. */

import type { GNodePrim } from '@/engine/scene';
import { GRAPH_NODE_R } from '@/engine/layout/graph';
import { LINKED_STROKE, PATTERN, TICK_PATH, markStyle } from './marks';
import { PrimGroup } from './PrimGroup';

export function GNode({ p }: { p: GNodePrim }) {
  const s = markStyle(p.mark);
  const r = GRAPH_NODE_R;
  const stroke = p.compared ? 'var(--amber)' : s.stroke;
  return (
    <PrimGroup id={p.id} x={p.x} y={p.y} kind="move">
      {(linked) => (
        <>
          <circle r={r} fill={s.fill} fillOpacity={s.fillOpacity} stroke={linked ? LINKED_STROKE : stroke} strokeWidth={linked ? 2.5 : p.compared ? 2 : s.strokeWidth} strokeDasharray={s.dash} />
          {s.dots && <circle r={r} fill={`url(#${PATTERN.dots})`} />}
          {p.read && <circle r={r + 4} fill="none" stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="1.5 3" />}
          {s.tick && <path d={TICK_PATH} transform={`translate(${r - 12} ${-r + 1})`} fill="none" stroke={s.textFill} strokeWidth={1.5} />}
          <text y={5} textAnchor="middle" fontSize={14} fill={s.textFill}>
            {p.label}
          </text>
          <text y={r + 14} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
            {p.text ?? '∞'}
          </text>
          {p.skipped && (
            <text y={-r - 6} textAnchor="middle" fontSize={9} fill="var(--ink-2)">
              stale
            </text>
          )}
        </>
      )}
    </PrimGroup>
  );
}
