/** Array layout (docs/ARCHITECTURE.md §4). Computed once per run from the union
 *  of every array that ever exists, so a row's geometry never changes between
 *  steps. Rows: 'hold' (a lifted 1-slot buffer) above the main row 'a', then
 *  every other array below in order of first appearance. */

import type { ArrayName } from '../events';
import type { Run } from '../run';
import { PAD } from './constants';

export interface ArrayRowLayout {
  name: ArrayName;
  /** Number of slots (the largest size the array ever has). */
  n: number;
  /** Left edge of slot 0. */
  x0: number;
  cellW: number;
  /** Top of the bar area. */
  y: number;
  /** Height of the bar area; bars sit on its baseline. */
  barH: number;
  /** Tip of the caret triangles, below the bars and the index labels. */
  caretY: number;
}

export interface ArrayLayout {
  rows: Record<ArrayName, ArrayRowLayout>;
  /** Top to bottom. */
  order: ArrayName[];
  /** Largest element value in the run (bar heights scale against it). */
  maxValue: number;
  cellW: number;
}

export const ARRAY_MAX_CELL = 56;
export const ARRAY_BAR_H = 64;
/** Vertical size of one array block: bars + caret row + label gap. */
export const ARRAY_ROW_H = ARRAY_BAR_H + 56;
/** Space above the first row for region bracket labels and compare badges. */
export const ARRAY_TOP_GAP = 40;

/** Union of array names → largest size seen, in order of first appearance. */
export function arraysInRun(run: Run): { name: ArrayName; n: number }[] {
  const seen = new Map<ArrayName, number>();
  for (const s of run.states) {
    for (const arr of Object.values(s.arrays)) {
      seen.set(arr.name, Math.max(seen.get(arr.name) ?? 0, arr.slots.length));
    }
  }
  return [...seen.entries()].map(([name, n]) => ({ name, n }));
}

export function layoutArrays(run: Run, width: number, top: number): { layout: ArrayLayout; height: number } | null {
  const arrays = arraysInRun(run);
  if (arrays.length === 0) return null;
  const order = [
    ...arrays.filter((a) => a.name === 'hold').map((a) => a.name),
    ...arrays.filter((a) => a.name === 'a').map((a) => a.name),
    ...arrays.filter((a) => a.name !== 'hold' && a.name !== 'a').map((a) => a.name),
  ];
  const nMax = Math.max(1, ...arrays.map((a) => a.n));
  const cellW = Math.min(ARRAY_MAX_CELL, (width - 2 * PAD) / nMax);
  let maxValue = 1;
  for (const s of run.states) for (const el of Object.values(s.elements)) maxValue = Math.max(maxValue, Math.abs(el.value));

  const rows: Record<ArrayName, ArrayRowLayout> = {};
  let y = top + ARRAY_TOP_GAP;
  for (const name of order) {
    const n = arrays.find((a) => a.name === name)?.n ?? 0;
    rows[name] = { name, n, x0: PAD, cellW, y, barH: ARRAY_BAR_H, caretY: y + ARRAY_BAR_H + 18 };
    y += ARRAY_ROW_H;
  }
  return { layout: { rows, order, maxValue, cellW }, height: y - top };
}

/** Centre x of slot i in a row (i may be −1 or n for carets outside the cells). */
export function slotCenter(row: ArrayRowLayout, i: number): number {
  return row.x0 + i * row.cellW + row.cellW / 2;
}
