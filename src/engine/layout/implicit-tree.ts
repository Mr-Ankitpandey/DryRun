/** Implicit-tree layout (an array also drawn as a binary tree, e.g. a heap):
 *  slot i sits at depth d = floor(log2(i + 1)), position p = i − (2^d − 1)
 *  within its level, x = left + (p + ½) · inner / 2^d, y = y0 + d · rowH.
 *  Positions belong to SLOTS and are computed once per run from the largest
 *  size the array ever has, so an element that moves between slots travels
 *  between fixed points (object constancy in the tree as in the array). */

import type { ArrayName } from '../events';
import type { Run } from '../run';
import { PAD } from './constants';
import { TREE_NODE_R } from './tree';

export interface ImplicitTreeLayout {
  arr: ArrayName;
  /** Centre of slot i's node. */
  pos: { x: number; y: number }[];
  r: number;
  rowH: number;
  /** Deepest level index (root = 0). */
  depth: number;
}

export const IMPLICIT_ROW_H = 60;

export const depthOfSlot = (i: number): number => Math.floor(Math.log2(i + 1));
export const parentSlot = (i: number): number => Math.floor((i - 1) / 2);

/** The deepest level that holds two or more nodes when the array has n slots
 *  (level d holds slots 2^d − 1 .. 2^(d+1) − 2), or −1 when none does. Node
 *  spacing on that level, inner / 2^d, is what bounds the drawing's width. */
export function crowdedLevel(n: number): number {
  return n >= 3 ? Math.floor(Math.log2(n - 1)) : -1;
}

export function layoutImplicitTree(run: Run, width: number, top: number): { layout: ImplicitTreeLayout; height: number } | null {
  const arr = run.states.find((s) => s.implicitTree !== undefined)?.implicitTree;
  if (arr === undefined) return null;
  let n = 0;
  for (const s of run.states) n = Math.max(n, s.arrays[arr]?.slots.length ?? 0);
  if (n === 0) return null;
  const depth = depthOfSlot(n - 1);
  const inner = width - 2 * PAD;
  const y0 = top + PAD + TREE_NODE_R;
  const pos: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const d = depthOfSlot(i);
    const p = i - (2 ** d - 1);
    pos.push({ x: PAD + ((p + 0.5) * inner) / 2 ** d, y: y0 + d * IMPLICIT_ROW_H });
  }
  const height = PAD + 2 * TREE_NODE_R + depth * IMPLICIT_ROW_H + PAD;
  return { layout: { arr, pos, r: TREE_NODE_R, rowH: IMPLICIT_ROW_H, depth }, height };
}
