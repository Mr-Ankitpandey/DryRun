/** DP grid layout (docs/ARCHITECTURE.md §4): `cellW = min(44, available / (cols + 1))`;
 *  the extra column holds row labels, and one extra row holds column labels.
 *  Computed once from the first state that carries a grid. */

import type { Run } from '../run';
import type { GridState } from '../state';
import { PAD } from './constants';

export interface GridLayout {
  rows: number;
  cols: number;
  rowLabels: string[];
  colLabels: string[];
  /** Left edge of column 0 (after the label column). */
  x0: number;
  /** Top edge of row 0 (after the label row). */
  y0: number;
  cellW: number;
  cellH: number;
}

export const GRID_MAX_CELL = 44;

export function layoutGrid(run: Run, width: number, top: number): { layout: GridLayout; height: number } | null {
  const grid = run.states.find((s) => s.grid !== null)?.grid;
  if (!grid) return null;
  return layoutGridState(grid, width, top);
}

export function layoutGridState(grid: GridState, width: number, top: number): { layout: GridLayout; height: number } {
  const cellW = Math.min(GRID_MAX_CELL, (width - 2 * PAD) / (grid.cols + 1));
  const cellH = cellW;
  const layout: GridLayout = {
    rows: grid.rows,
    cols: grid.cols,
    rowLabels: grid.rowLabels,
    colLabels: grid.colLabels,
    x0: PAD + cellW,
    y0: top + PAD + cellH,
    cellW,
    cellH,
  };
  return { layout, height: PAD + cellH * (grid.rows + 1) + PAD };
}
