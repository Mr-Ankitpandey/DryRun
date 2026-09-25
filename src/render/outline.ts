/** Outlines around a primitive, in scene units and centred on the primitive,
 *  for the trace layer's overlays: pick targets, the ghost of a wrong guess,
 *  the correct ring. Pure. */

import type { Id } from '@/engine/events';
import { ARRAY_BAR_H } from '@/engine/layout/array';
import { GRAPH_NODE_R } from '@/engine/layout/graph';
import { TREE_NODE_R } from '@/engine/layout/tree';
import type { Scene } from '@/engine/scene';

export type Outline =
  | { shape: 'rect'; cx: number; cy: number; w: number; h: number }
  | { shape: 'circle'; cx: number; cy: number; r: number };

/** The outline hugging a primitive, grown by `pad` on every side. */
export function outlineOf(scene: Scene, id: Id, pad = 4): Outline | null {
  const p = scene.prims.get(id);
  if (!p) return null;
  switch (p.kind) {
    case 'bar': {
      const w = p.w - 4 + 2 * pad;
      const h = p.h + 2 * pad;
      return { shape: 'rect', cx: p.x + p.w / 2, cy: p.y + p.h / 2, w, h };
    }
    case 'cell':
      return { shape: 'rect', cx: p.x + p.w / 2, cy: p.y + p.h / 2, w: p.w - 2 + 2 * pad, h: p.h - 2 + 2 * pad };
    case 'frame':
      return { shape: 'rect', cx: p.x, cy: p.y, w: p.w + 2 * pad, h: p.h + 2 * pad };
    case 'tnode':
      return { shape: 'circle', cx: p.x, cy: p.y, r: TREE_NODE_R + pad };
    case 'gnode':
      return { shape: 'circle', cx: p.x, cy: p.y, r: GRAPH_NODE_R + pad };
    default:
      return null;
  }
}

/** A generous hit area for tapping a primitive: a bar's whole slot column
 *  (short bars are still easy to hit) and at least 44 units across. */
export function hitOutlineOf(scene: Scene, id: Id): Outline | null {
  const p = scene.prims.get(id);
  if (!p) return null;
  if (p.kind === 'bar') {
    const bottom = p.y + p.h;
    const top = bottom - Math.max(p.h, ARRAY_BAR_H) - 6;
    const h = bottom + 16 - top;
    return { shape: 'rect', cx: p.x + p.w / 2, cy: top + h / 2, w: p.w, h };
  }
  const o = outlineOf(scene, id, 6);
  if (!o) return null;
  if (o.shape === 'circle') return { ...o, r: Math.max(o.r, 22) };
  return { ...o, w: Math.max(o.w, 44), h: Math.max(o.h, 44) };
}

/** SVG path of an outline centred on (0, 0), drawn clockwise from the top
 *  left, so pathLength animations sketch it like a pen stroke. */
export function outlinePath(o: Outline, radius = 4): string {
  if (o.shape === 'circle') {
    const r = o.r;
    return `M0 ${-r} A${r} ${r} 0 1 1 0 ${r} A${r} ${r} 0 1 1 0 ${-r} Z`;
  }
  const x = -o.w / 2;
  const y = -o.h / 2;
  const r = Math.min(radius, o.w / 2, o.h / 2);
  return `M${x + r} ${y} H${x + o.w - r} Q${x + o.w} ${y} ${x + o.w} ${y + r} V${y + o.h - r} Q${x + o.w} ${y + o.h} ${x + o.w - r} ${y + o.h} H${x + r} Q${x} ${y + o.h} ${x} ${y + o.h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
}

/** Top-right corner of an outline, relative to its centre (badges sit here). */
export function outlineCorner(o: Outline): { x: number; y: number } {
  if (o.shape === 'circle') return { x: o.r * 0.72, y: -o.r * 0.72 };
  return { x: o.w / 2, y: -o.h / 2 };
}
