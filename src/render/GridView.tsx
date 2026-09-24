/** DP grid: row and column labels from the layout, then every cell (empty
 *  until computed). Dependency arrows are drawn by the Links layer. */

import type { Layout } from '@/engine/layout';
import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { Cell } from './Cell';

export function GridView({ scene, layout }: { scene: Scene; layout: Layout }) {
  const gl = layout.grid;
  if (!gl) return null;
  const cells = primsOf(scene, 'cell');
  if (cells.length === 0) return null;
  return (
    <g data-view="grid">
      {gl.colLabels.map((label, c) => (
        <text key={`c${c}`} x={gl.x0 + c * gl.cellW + gl.cellW / 2} y={gl.y0 - 8} textAnchor="middle" fontSize={10} fill="var(--ink-2)">
          {label}
        </text>
      ))}
      {gl.rowLabels.map((label, r) => (
        <text key={`r${r}`} x={gl.x0 - 8} y={gl.y0 + r * gl.cellH + gl.cellH / 2 + 4} textAnchor="end" fontSize={10} fill="var(--ink-2)">
          {label}
        </text>
      ))}
      {cells.map((c) => (
        <Cell key={c.id} p={c} />
      ))}
    </g>
  );
}
