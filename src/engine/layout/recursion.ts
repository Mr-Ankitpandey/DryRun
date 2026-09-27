/** Recursion-tree layout (docs/ARCHITECTURE.md §4): one node per call frame at
 *  `x = midpoint of the segment args.lo..args.hi` mapped to the main array's
 *  cell centres and `y = depth × rowH`, so the tree lines up with the array
 *  above it. Frames persist in state after they return, so the union over the
 *  run gives every frame; positions are fixed once per run. Frames without
 *  numeric lo/hi (e.g. dfs(u)) get a tidy tree layout instead: each frame's
 *  horizontal share is proportional to the leaves under it, the whole forest is
 *  scaled to the stage width, and siblings keep call order, so subtrees never
 *  overlap. */

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
  const yAt = (d: number) => top + PAD + d * REC_ROW_H + REC_NODE_H / 2;
  const hasSegment = (f: Frame) => row !== undefined && typeof f.args['lo'] === 'number' && typeof f.args['hi'] === 'number';

  const tidy: Frame[] = [];
  for (const f of byId) {
    const d = depthOf(f);
    depth = Math.max(depth, d);
    if (!hasSegment(f) || !row) {
      tidy.push(f);
      continue;
    }
    const lo = f.args['lo'] as number;
    const hi = f.args['hi'] as number;
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    const x = (slotCenter(row, a) + slotCenter(row, b)) / 2;
    const w = Math.max(row.cellW - 6, (b - a + 1) * row.cellW - 6);
    pos[f.id] = { x, y: yAt(d), w };
  }

  if (tidy.length > 0) {
    const inTidy = new Set(tidy.map((f) => f.id));
    const children = new Map<Id | null, Frame[]>();
    for (const f of tidy) {
      const parent = f.parent !== null && inTidy.has(f.parent) ? f.parent : null;
      const list = children.get(parent) ?? [];
      list.push(f);
      children.set(parent, list);
    }
    const leaves = new Map<Id, number>();
    const countLeaves = (f: Frame): number => {
      const kids = children.get(f.id) ?? [];
      const n = kids.length === 0 ? 1 : kids.reduce((sum, k) => sum + countLeaves(k), 0);
      leaves.set(f.id, n);
      return n;
    };
    const roots = children.get(null) ?? [];
    const total = roots.reduce((sum, r) => sum + countLeaves(r), 0);
    const slot = Math.min(REC_FALLBACK_W + 8, (width - 2 * PAD) / Math.max(1, total));
    const w = Math.max(24, Math.min(REC_FALLBACK_W, slot - 8));
    const left = width / 2 - (slot * total) / 2;
    const place = (f: Frame, start: number) => {
      const n = leaves.get(f.id) ?? 1;
      pos[f.id] = { x: left + (start + n / 2) * slot, y: yAt(depthOf(f)), w };
      let cursor = start;
      for (const k of children.get(f.id) ?? []) {
        place(k, cursor);
        cursor += leaves.get(k.id) ?? 1;
      }
    };
    let cursor = 0;
    for (const r of roots) {
      place(r, cursor);
      cursor += leaves.get(r.id) ?? 1;
    }
  }
  return { layout: { pos, rowH: REC_ROW_H, h: REC_NODE_H, depth }, height: PAD + (depth + 1) * REC_ROW_H + PAD };
}
