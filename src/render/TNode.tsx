/** A BST node: circle with its key. Floating (detached) nodes get a dashed
 *  ink-2 ring; marks follow marks.ts; amber stroke while compared, dotted
 *  outline while read. */

import type { TNodePrim } from '@/engine/scene';
import { TREE_NODE_R } from '@/engine/layout/tree';
import { LINKED_STROKE, PATTERN, TICK_PATH, markStyle } from './marks';
import { PrimGroup } from './PrimGroup';

export function TNode({ p }: { p: TNodePrim }) {
  const s = markStyle(p.mark);
  const r = TREE_NODE_R;
  const stroke = linkedOr(p, s.stroke);
  return (
    <PrimGroup id={p.id} x={p.x} y={p.y} kind="move">
      {(linked) => (
        <>
          <circle r={r} fill={s.fill} fillOpacity={s.fillOpacity} stroke={linked ? LINKED_STROKE : stroke} strokeWidth={linked ? 2.5 : p.compared ? 2 : s.strokeWidth} strokeDasharray={p.floating ? '4 3' : s.dash} />
          {s.dots && <circle r={r} fill={`url(#${PATTERN.dots})`} />}
          {p.read && <circle r={r + 4} fill="none" stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="1.5 3" />}
          {s.tick && <path d={TICK_PATH} transform={`translate(${r - 12} ${-r + 2})`} fill="none" stroke={s.textFill} strokeWidth={1.5} />}
          <text y={5} textAnchor="middle" fontSize={14} fill={s.textFill}>
            {p.key}
          </text>
        </>
      )}
    </PrimGroup>
  );
}

function linkedOr(p: TNodePrim, stroke: string): string {
  if (p.compared) return 'var(--amber)';
  if (p.floating && p.mark === null) return 'var(--ink-2)';
  return stroke;
}
