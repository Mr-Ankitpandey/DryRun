/** Recursion-tree layout (docs/ARCHITECTURE.md §4): one node per call frame at
 *  `x = midpoint of the segment args.lo..args.hi` mapped to the main array's
 *  cell centres and `y = depth × rowH`, so the tree lines up with the array
 *  above it. Frames persist in state after they return, so the union over the
 *  run gives every frame; positions are fixed once per run. Frames without
 *  numeric lo/hi fall back to a slot under their parent, ordered by id. */

import type { Id } from '../events';
import type { Run } from '../run';
import type { Frame } from '../state';
import type { ArrayLayout } from './array';
import { slotCenter } from './array';
import { PAD } from './constants';

export interface RecursionLayout {
  pos: Record<Id, { x: number; y: number; w: number }>;
  rowH: number;
  /** Node height. */
  h: number;
  depth: number;
}

export const REC_ROW_H = 44;
export const REC_NODE_H = 26;
export const REC_FALLBACK_W = 96;

export function layoutRecursion(run: Run, width: number, top: number, arrays: ArrayLayout | null): { layout: RecursionLayout; height: number } | null {
  const frames = new Map<Id, Frame>();
  for (const s of run.states) for (const f of Object.values(s.frames)) if (!frames.has(f.id)) frames.set(f.id, f);
  if (frames.size === 0) return null;

  const depthOf = (f: Frame): number => {
    let d = 0;
    let cur = f;
    while (cur.parent !== null) {
      const p = frames.get(cur.parent);
      if (!p) break;
      d++;
      cur = p;
    }
    return d;
  };

  const row = arrays ? (arrays.rows['a'] ?? arrays.rows[arrays.order[0] as string]) : undefined;
  const pos: Record<Id, { x: number; y: number; w: number }> = {};
  let depth = 0;
  const byId = [...frames.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const childCount = new Map<Id | null, number>();
  for (const f of byId) {
    const d = depthOf(f);
    depth = Math.max(depth, d);
    const y = top + PAD + d * REC_ROW_H + REC_NODE_H / 2;
    const lo = f.args['lo'];
    const hi = f.args['hi'];
    if (row && typeof lo === 'number' && typeof hi === 'number') {
      const a = Math.min(lo, hi);
      const b = Math.max(lo, hi);
      const x = (slotCenter(row, a) + slotCenter(row, b)) / 2;
      const w = Math.max(row.cellW - 6, (b - a + 1) * row.cellW - 6);
      pos[f.id] = { x, y, w };
    } else {
      const k = childCount.get(f.parent) ?? 0;
      childCount.set(f.parent, k + 1);
      const parent = f.parent === null ? null : pos[f.parent];
      const x = (parent ? parent.x : width / 2) + k * (REC_FALLBACK_W + 8);
      pos[f.id] = { x, y, w: REC_FALLBACK_W };
    }
  }
  return { layout: { pos, rowH: REC_ROW_H, h: REC_NODE_H, depth }, height: PAD + (depth + 1) * REC_ROW_H + PAD };
}
