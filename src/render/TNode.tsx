/** A tree node: circle with its key and, above it, its text when it has one
 *  (a node mirroring an array element links to it on hover through `ref`). Floating (detached) nodes get a dashed
 *  ink-2 ring; marks follow marks.ts; amber stroke while compared, dotted
 *  outline while read. */

import { memo } from 'react';
import type { TNodePrim } from '@/engine/scene';
import type { Lift } from './motion-hints';
import { TREE_NODE_R } from '@/engine/layout/tree';
import { TNODE_TEXT_GAP } from './labels';
import { LINKED_STROKE, TICK_PATH, markStyle } from './marks';
import { sameProps } from './memo';
import { usePatterns } from './patterns';
import { PrimGroup } from './PrimGroup';

export const TNode = memo(function TNode({ p, lift }: { p: TNodePrim; lift?: Lift | undefined }) {
  const PATTERN = usePatterns();
  const s = markStyle(p.mark);
  const r = TREE_NODE_R;
  const stroke = linkedOr(p, s.stroke);
  return (
    <PrimGroup id={p.id} linkRef={p.ref ?? null} x={p.x} y={p.y} kind="move" lift={lift}>
      {(linked) => (
        <>
          {/* Opaque base: a tinted (semi-transparent) mark must not let edges show through. */}
          <circle r={r} fill="var(--surface)" />
          <circle r={r} fill={s.fill} fillOpacity={s.fillOpacity} stroke={linked ? LINKED_STROKE : stroke} strokeWidth={linked ? 2.5 : p.compared ? 2 : s.strokeWidth} strokeDasharray={p.floating ? '4 3' : s.dash} />
          {s.dots && <circle r={r} fill={`url(#${PATTERN.dots})`} />}
          {p.read && <circle r={r + 4} fill="none" stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="1.5 3" />}
          {s.tick && <path d={TICK_PATH} transform={`translate(${r - 12} ${-r + 2})`} fill="none" stroke={s.textFill} strokeWidth={1.5} />}
          <text y={5} textAnchor="middle" fontSize={14} fill={s.textFill}>
            {p.key}
          </text>
          {p.text !== undefined && (
            <text y={-r - TNODE_TEXT_GAP} textAnchor="middle" fontSize={10} fill="var(--ink-2)">
              {p.text}
            </text>
          )}
        </>
      )}
    </PrimGroup>
  );
}, sameProps);

function linkedOr(p: TNodePrim, stroke: string): string {
  if (p.compared) return 'var(--amber)';
  if (p.floating && p.mark === null) return 'var(--ink-2)';
  return stroke;
}
