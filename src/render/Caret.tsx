/** A pointer: triangle caret below the cell with its name in mono (pen). */

import type { CaretPrim } from '@/engine/scene';
import { LINKED_STROKE } from './marks';
import { PrimGroup } from './PrimGroup';

/** `stack` offsets the label when several carets share a slot (i = j = lo). */
export function Caret({ p, stack = 0 }: { p: CaretPrim; stack?: number }) {
  return (
    <PrimGroup id={p.id} x={p.x} y={p.y} opacity={p.visible ? 1 : 0} kind="settle">
      {(linked) => (
        <>
          <path d="M0 0 L-6 9 L6 9 Z" fill="var(--pen)" stroke={linked ? LINKED_STROKE : 'none'} strokeWidth={linked ? 2 : 0} />
          <text y={22 + stack * 13} textAnchor="middle" fontSize={12} fill="var(--pen)">
            {p.name}
          </text>
        </>
      )}
    </PrimGroup>
  );
}
