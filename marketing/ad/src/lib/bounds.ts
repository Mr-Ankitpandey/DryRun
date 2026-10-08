/** The area of the stage a beat actually uses, over all the scenes it shows,
 *  so the ad can zoom to it once (no zoom jumps inside a beat). Scene units. */

import type { Scene } from '@/engine/scene';
import { GRAPH_NODE_R } from '@/engine/layout/graph';
import { TREE_NODE_R } from '@/engine/layout/tree';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const PAD = 22;

export function boundsOf(scenes: readonly Scene[]): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    b.minX = Math.min(b.minX, x0);
    b.minY = Math.min(b.minY, y0);
    b.maxX = Math.max(b.maxX, x1);
    b.maxY = Math.max(b.maxY, y1);
  };
  for (const scene of scenes) {
    for (const prim of scene.prims.values()) {
      const p = prim as unknown as Record<string, unknown>;
      if (p.kind === 'row' || p.visible === false) continue; // panel rows are HTML, not stage
      const n = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
      const [x, y, w, h] = [n('x'), n('y'), n('w'), n('h')];
      const [x1, y1, x2, y2] = [n('x1'), n('y1'), n('x2'), n('y2')];
      if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) add(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2));
      if (x === null || y === null) continue;
      if (w !== null && h !== null) add(x, y, x + w, y + h + 14); // + index label under cells
      else if (p.kind === 'tnode') add(x - TREE_NODE_R, y - TREE_NODE_R - 20, x + TREE_NODE_R, y + TREE_NODE_R + 20);
      else if (p.kind === 'gnode') add(x - GRAPH_NODE_R, y - GRAPH_NODE_R, x + GRAPH_NODE_R, y + GRAPH_NODE_R + 24);
      else if (p.kind === 'caret') add(x - 16, y, x + 16, y + 30);
      else add(x - 10, y - 10, x + 10, y + 10);
    }
  }
  if (!Number.isFinite(b.minX)) return { minX: 0, minY: 0, maxX: 900, maxY: 300 };
  return { minX: b.minX - PAD, minY: b.minY - PAD, maxX: b.maxX + PAD, maxY: b.maxY + PAD };
}
