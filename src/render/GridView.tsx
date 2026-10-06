/** DP grid: row and column labels from the layout, then every cell (empty
 *  until computed). Dependency arrows are drawn by the Links layer.
 *
 *  Labels are 13 units, so they stay ≥ 11 CSS px on a 360 px phone (the phone
 *  layout draws at ~0.88×); a row label's trailing "(w, v)" goes on a second
 *  line so the label column does not squeeze the grid. */

import type { Layout } from '@/engine/layout';
import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { Cell } from './Cell';
import { GRID_LABEL_FONT, gridLabelLines } from './labels';

const LINE = 13;

export function GridView({ scene, layout }: { scene: Scene; layout: Layout }) {
  const gl = layout.grid;
  if (!gl) return null;
  const cells = primsOf(scene, 'cell');
  if (cells.length === 0) return null;
  return (
    <g data-view="grid">
      {gl.colLabels.map((label, c) => (
        <text key={`c${c}`} x={gl.x0 + c * gl.cellW + gl.cellW / 2} y={gl.y0 - 9} textAnchor="middle" fontSize={GRID_LABEL_FONT} fill="var(--ink-2)">
          {label}
        </text>
      ))}
      {gl.rowLabels.map((label, r) => {
        const lines = gridLabelLines(label);
        const cy = gl.y0 + r * gl.cellH + gl.cellH / 2 + 4.5 - ((lines.length - 1) * LINE) / 2;
        return (
          <text key={`r${r}`} x={gl.x0 - 8} y={cy} textAnchor="end" fontSize={GRID_LABEL_FONT} fill="var(--ink-2)">
            {lines.map((l, i) => (
              <tspan key={i} x={gl.x0 - 8} dy={i === 0 ? 0 : LINE}>
                {l}
              </tspan>
            ))}
          </text>
        );
      })}
      {cells.map((c) => (
        <Cell key={c.id} p={c} />
      ))}
    </g>
  );
}
