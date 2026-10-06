/** Where each graph edge's weight badge goes (pure). The midpoint is the
 *  natural spot, but in a layered layout another node's circle or its
 *  distance label can sit right there. So candidates slide along the edge
 *  (towards either end) and step off it along the normal, and the first one
 *  that clears every node circle (with its read ring), every distance label,
 *  every "stale" tag and every badge already placed wins (if none does, the
 *  one that overlaps least). Positions depend
 *  only on the fixed topology, so badges never jump between steps. */

import type { Id } from '@/engine/events';

export interface BadgeNode {
  x: number;
  y: number;
}
export interface BadgeEdge {
  id: Id;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number | null;
}
/** Centre and size of an axis-aligned box. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BADGE_H = 16;
/** Badge width for a weight: 18 units, wider for 2+ digits (11-unit mono). */
export function badgeWidth(w: number): number {
  return Math.max(18, String(w).length * 6.6 + 8);
}

const ALONG = [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73];
const ACROSS = [0, 11, -11, 19, -19, 28, -28];

function boxesOverlap(a: Box, b: Box, gap: number): boolean {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w + 2 * gap && Math.abs(a.y - b.y) * 2 < a.h + b.h + 2 * gap;
}

function boxHitsCircle(b: Box, cx: number, cy: number, r: number): boolean {
  const nx = Math.max(b.x - b.w / 2, Math.min(cx, b.x + b.w / 2));
  const ny = Math.max(b.y - b.h / 2, Math.min(cy, b.y + b.h / 2));
  return (nx - cx) ** 2 + (ny - cy) ** 2 < r * r;
}

/** Boxes a node draws besides its circle: the distance label under it (room
 *  for 4 characters, so a growing distance never needs a new spot) and the
 *  "stale" tag above it. Matches GNode's text positions. */
export function nodeLabelBoxes(n: BadgeNode, r: number): Box[] {
  return [
    { x: n.x, y: n.y + r + 10, w: 4 * 6.6 + 4, h: 15 },
    { x: n.x, y: n.y - r - 9.5, w: 34, h: 13 },
  ];
}

export function placeWeightBadges(nodes: readonly BadgeNode[], edges: readonly BadgeEdge[], r: number): Map<Id, { x: number; y: number }> {
  const out = new Map<Id, { x: number; y: number }>();
  const labels = nodes.flatMap((n) => nodeLabelBoxes(n, r));
  const placed: Box[] = [];
  for (const e of edges) {
    if (e.w === null) continue;
    const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1;
    const nx = -(e.y2 - e.y1) / len;
    const ny = (e.x2 - e.x1) / len;
    const w = badgeWidth(e.w);
    let best: Box | null = null;
    let bestHits = Infinity;
    search: for (const off of ACROSS) {
      for (const t of ALONG) {
        const b: Box = { x: e.x1 + (e.x2 - e.x1) * t + nx * off, y: e.y1 + (e.y2 - e.y1) * t + ny * off, w, h: BADGE_H };
        const hits =
          nodes.filter((n) => boxHitsCircle(b, n.x, n.y, r + 5)).length * 4 +
          labels.filter((l) => boxesOverlap(b, l, 4)).length * 2 +
          placed.filter((p) => boxesOverlap(b, p, 2)).length;
        if (hits < bestHits) {
          best = b;
          bestHits = hits;
        }
        if (hits === 0) break search;
      }
    }
    const b = best ?? { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2, w, h: BADGE_H };
    placed.push(b);
    out.set(e.id, { x: b.x, y: b.y });
  }
  return out;
}
