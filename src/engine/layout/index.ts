/** Layout = geometry computed ONCE per run (docs/ARCHITECTURE.md §4). The scene
 *  builder reads positions from it at every step; nothing here depends on a
 *  single state, so an element's coordinates are stable across steps unless
 *  the state moves it. Sections stack vertically in a fixed order: arrays
 *  (hold, a, others), the implicit tree of an array, recursion tree, BST (or
 *  a forest), graph, grid. */

import type { Run } from '../run';
import type { ArrayLayout } from './array';
import { layoutArrays } from './array';
import { SCENE_WIDTH } from './constants';
import type { GraphLayout } from './graph';
import { layoutGraph } from './graph';
import type { ForestLayout } from './forest';
import { layoutForest } from './forest';
import type { GridLayout } from './grid';
import { layoutGrid } from './grid';
import type { ImplicitTreeLayout } from './implicit-tree';
import { layoutImplicitTree } from './implicit-tree';
import type { RecursionLayout } from './recursion';
import { layoutRecursion } from './recursion';
import type { TreeLayout } from './tree';
import { layoutTree } from './tree';

export interface Layout {
  width: number;
  height: number;
  array: ArrayLayout | null;
  /** An array drawn as its implicit binary tree, right under the arrays. */
  implicitTree: ImplicitTreeLayout | null;
  recursion: RecursionLayout | null;
  tree: TreeLayout | null;
  /** A multi-root tree (`forest`), in place of `tree`. */
  forest: ForestLayout | null;
  graph: GraphLayout | null;
  grid: GridLayout | null;
}

export function computeLayout(run: Run, viewport: { width?: number } = {}): Layout {
  const width = viewport.width ?? SCENE_WIDTH;
  let y = 0;
  const arr = layoutArrays(run, width, y);
  if (arr) y += arr.height;
  const imp = layoutImplicitTree(run, width, y);
  if (imp) y += imp.height;
  const rec = layoutRecursion(run, width, y, arr?.layout ?? null);
  if (rec) y += rec.height;
  const tree = layoutTree(run, width, y);
  if (tree) y += tree.height;
  const forest = layoutForest(run, width, y);
  if (forest) y += forest.height;
  const graph = layoutGraph(run, width, y);
  if (graph) y += graph.height;
  const grid = layoutGrid(run, width, y);
  if (grid) y += grid.height;
  return {
    width,
    height: Math.max(y, 80),
    array: arr?.layout ?? null,
    implicitTree: imp?.layout ?? null,
    recursion: rec?.layout ?? null,
    tree: tree?.layout ?? null,
    forest: forest?.layout ?? null,
    graph: graph?.layout ?? null,
    grid: grid?.layout ?? null,
  };
}

export type { ArrayLayout, ArrayRowLayout } from './array';
export { slotCenter } from './array';
export { PAD, SCENE_WIDTH } from './constants';
export type { GraphLayout } from './graph';
export type { ForestLayout } from './forest';
export { forestPositions } from './forest';
export type { GridLayout } from './grid';
export type { ImplicitTreeLayout } from './implicit-tree';
export { crowdedLevel, depthOfSlot, parentSlot } from './implicit-tree';
export type { RecursionLayout } from './recursion';
export type { Side, TreeLayout } from './tree';
export { floatOrigin, pathOf, topOf, treePos } from './tree';
