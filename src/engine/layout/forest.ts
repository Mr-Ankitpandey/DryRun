/** Forest layout (a tree with `forest` set, e.g. union-find): roots side by
 *  side in id order, each tree tidy. Every node owns one column, so a tree of
 *  s nodes spans s columns and the whole forest always spans n columns: a
 *  root sits at the centre of its span and its children's spans (in id order)
 *  are packed half a column in, so a single child hangs straight below it.
 *  Spans of different subtrees never overlap, so no two nodes collide, and
 *  edges only run between neighbouring rows.
 *
 *  The static part (column width, rows) is computed once per run from every
 *  node that ever exists and the deepest tree; positions are computed per
 *  state from parent pointers (`forestPositions`), so a relinked node and its
 *  subtree move, and trees whose span changes slide along on the move spring. */

import type { Id } from '../events';
import type { Run } from '../run';
import type { State } from '../state';
import { PAD } from './constants';
import { TREE_NODE_R } from './tree';

export interface ForestLayout {
  /** Left edge of column 0. */
  x0: number;
  colW: number;
  /** y of the root row. */
  y0: number;
  rowH: number;
  depth: number;
  /** Columns: every node that ever exists. */
  n: number;
}

export const FOREST_MAX_COL = 72;
/** Tall rows keep an edge to a far child clear of the nearer children it passes over. */
export const FOREST_ROW_H = 96;
/** Room above the root row for a root's label (e.g. its rank). */
const LABEL_ROOM = 20;

const byId = (a: Id, b: Id) => a.localeCompare(b, 'en', { numeric: true });

function depthOf(state: State, id: Id): number {
  let d = 0;
  for (let cur = state.tree[id]; cur && cur.parent !== null; cur = state.tree[cur.parent]) d++;
  return d;
}

export function layoutForest(run: Run, width: number, top: number): { layout: ForestLayout; height: number } | null {
  if (!run.states.some((s) => s.forest)) return null;
  const ids = new Set<Id>();
  let depth = 0;
  for (const s of run.states) {
    for (const id of Object.keys(s.tree)) {
      ids.add(id);
      depth = Math.max(depth, depthOf(s, id));
    }
  }
  const n = Math.max(1, ids.size);
  const colW = Math.min(FOREST_MAX_COL, (width - 2 * PAD) / n);
  const layout: ForestLayout = { x0: width / 2 - (colW * n) / 2, colW, y0: top + PAD + LABEL_ROOM + TREE_NODE_R, rowH: FOREST_ROW_H, depth, n };
  return { layout, height: PAD + LABEL_ROOM + 2 * TREE_NODE_R + depth * FOREST_ROW_H + PAD };
}

/** Node centres for one state of a forest (see the file comment). */
export function forestPositions(state: State, layout: ForestLayout): Map<Id, { x: number; y: number }> {
  const kids = new Map<Id | null, Id[]>();
  for (const node of Object.values(state.tree)) {
    const list = kids.get(node.parent) ?? [];
    list.push(node.id);
    kids.set(node.parent, list);
  }
  for (const list of kids.values()) list.sort(byId);
  const size = new Map<Id, number>();
  const sizeOf = (id: Id): number => {
    const known = size.get(id);
    if (known !== undefined) return known;
    const s = 1 + (kids.get(id) ?? []).reduce((sum, k) => sum + sizeOf(k), 0);
    size.set(id, s);
    return s;
  };
  const out = new Map<Id, { x: number; y: number }>();
  const place = (id: Id, start: number, d: number) => {
    out.set(id, { x: layout.x0 + (start + sizeOf(id) / 2) * layout.colW, y: layout.y0 + d * layout.rowH });
    let cursor = start + 0.5;
    for (const k of kids.get(id) ?? []) {
      place(k, cursor, d + 1);
      cursor += sizeOf(k);
    }
  };
  let cursor = 0;
  for (const root of kids.get(null) ?? []) {
    place(root, cursor, 0);
    cursor += sizeOf(root);
  }
  return out;
}
