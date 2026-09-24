/** BST layout (docs/ARCHITECTURE.md §4): a node's position depends only on its
 *  root path, `x = cx + Σ_{d=1..depth} (±) span / 2^d`, `y = y0 + depth × rowH`,
 *  so a node moves only when its path changes. The layout itself is computed
 *  once per run: the deepest path across every state fixes the height and the
 *  span (the extreme leaf of the deepest path lands on the margin).
 *
 *  Floating subtrees (a node detached but not yet relinked or removed) are
 *  lifted into a reserved row above the root and laid out compactly. */

import type { Id } from '../events';
import type { Run } from '../run';
import type { State } from '../state';
import { PAD } from './constants';

export interface TreeLayout {
  cx: number;
  span: number;
  rowH: number;
  /** y of the root row. */
  y0: number;
  /** y of the lift row for floating subtrees. */
  liftY: number;
  r: number;
  /** Deepest depth that ever occurs in the run. */
  depth: number;
}

export type Side = 'L' | 'R';

export const TREE_ROW_H = 64;
export const TREE_NODE_R = 18;

export function layoutTree(run: Run, width: number, top: number): { layout: TreeLayout; height: number } | null {
  let any = false;
  let depth = 0;
  for (const s of run.states) {
    for (const id of Object.keys(s.tree)) {
      any = true;
      depth = Math.max(depth, pathOf(s, id).length);
    }
  }
  if (!any) return null;
  const liftY = top + PAD + TREE_NODE_R;
  const y0 = liftY + TREE_ROW_H;
  // The leftmost node at depth D sits at cx − span·(1 − 2^−D): pick the span so
  // it lands exactly on the left margin. Shallow runs spread wide; a depth-5
  // run keeps siblings ≥ span/32 apart (≈ 13 units at 900 wide: dense deep
  // trees may touch, which the input validators keep rare).
  const reach = width / 2 - PAD - TREE_NODE_R;
  const span = reach / (1 - 2 ** -Math.max(1, depth));
  const layout: TreeLayout = { cx: width / 2, span, rowH: TREE_ROW_H, y0, liftY, r: TREE_NODE_R, depth };
  const height = y0 + depth * TREE_ROW_H + TREE_NODE_R + PAD - top;
  return { layout, height };
}

/** Root path of a node (sides from the top of its tree, floating or not). */
export function pathOf(state: State, id: Id): Side[] {
  const path: Side[] = [];
  let cur = state.tree[id];
  while (cur && cur.parent !== null) {
    const parent = state.tree[cur.parent];
    if (!parent) break;
    path.push(parent.left === cur.id ? 'L' : 'R');
    cur = parent;
  }
  return path.reverse();
}

/** Top-most ancestor of a node (the root, or a floating subtree's root). */
export function topOf(state: State, id: Id): Id {
  let cur = state.tree[id];
  while (cur && cur.parent !== null && state.tree[cur.parent]) cur = state.tree[cur.parent];
  return cur ? cur.id : id;
}

export function treePos(layout: TreeLayout, path: readonly Side[], origin: { x: number; y: number; span: number } = { x: layout.cx, y: layout.y0, span: layout.span }): { x: number; y: number } {
  let x = origin.x;
  let denom = 2;
  for (const side of path) {
    x += (side === 'L' ? -1 : 1) * (origin.span / denom);
    denom *= 2;
  }
  return { x, y: origin.y + path.length * layout.rowH };
}

/** Origin for the k-th floating subtree (ordered by root id): the lift row,
 *  above the right child's column, with a compact span so its children hang
 *  beside the root row rather than on top of it. */
export function floatOrigin(layout: TreeLayout, k: number): { x: number; y: number; span: number } {
  const span = layout.span / 4;
  return { x: layout.cx + layout.span / 2 + k * (span + layout.r * 2), y: layout.liftY, span };
}
