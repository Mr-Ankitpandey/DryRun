import { describe, expect, it } from 'vitest';
import { BADGE_H, badgeWidth, nodeLabelBoxes, placeWeightBadges } from './edge-badges';

const R = 20;

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
}

describe('placeWeightBadges', () => {
  it('keeps the midpoint when nothing is in the way', () => {
    const nodes = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ];
    const pos = placeWeightBadges(nodes, [{ id: 'e', x1: 0, y1: 0, x2: 200, y2: 0, w: 3 }], R);
    expect(pos.get('e')).toEqual({ x: 100, y: 0 });
  });

  it("moves off a node's distance label that sits on the midpoint", () => {
    // Edge a–b passes right under node c, whose label is at the midpoint.
    const nodes = [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
      { x: 100, y: 64 },
    ];
    const pos = placeWeightBadges(nodes, [{ id: 'e', x1: 0, y1: 100, x2: 200, y2: 100, w: 12 }], R);
    const p = pos.get('e') ?? { x: NaN, y: NaN };
    const badge = { x: p.x, y: p.y, w: badgeWidth(12), h: BADGE_H };
    for (const n of nodes) for (const l of nodeLabelBoxes(n, R)) expect(overlaps(badge, l)).toBe(false);
    for (const n of nodes) expect(Math.hypot(badge.x - n.x, badge.y - n.y)).toBeGreaterThan(R);
  });

  it('never stacks two badges on each other', () => {
    const nodes = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 0, y: 30 },
      { x: 200, y: 30 },
    ];
    const pos = placeWeightBadges(
      nodes,
      [
        { id: 'a', x1: 0, y1: 0, x2: 200, y2: 30, w: 1 },
        { id: 'b', x1: 0, y1: 30, x2: 200, y2: 0, w: 2 },
      ],
      R,
    );
    const a = pos.get('a') ?? { x: 0, y: 0 };
    const b = pos.get('b') ?? { x: 0, y: 0 };
    expect(overlaps({ ...a, w: 18, h: BADGE_H }, { ...b, w: 18, h: BADGE_H })).toBe(false);
  });

  it('steps to the side of a short vertical edge between a label and a node', () => {
    // Node a's distance label and node b's circle leave no room on the line.
    const nodes = [
      { x: 240, y: 100 },
      { x: 240, y: 176 },
    ];
    const pos = placeWeightBadges(nodes, [{ id: 'e', x1: 240, y1: 100, x2: 240, y2: 176, w: 2 }], R);
    const p = pos.get('e') ?? { x: NaN, y: NaN };
    const badge = { x: p.x, y: p.y, w: badgeWidth(2), h: BADGE_H };
    for (const n of nodes) for (const l of nodeLabelBoxes(n, R)) expect(overlaps(badge, l)).toBe(false);
    expect(Math.abs(p.x - 240)).toBeLessThanOrEqual(28);
  });

  it('skips unweighted edges', () => {
    expect(placeWeightBadges([], [{ id: 'e', x1: 0, y1: 0, x2: 1, y2: 1, w: null }], R).size).toBe(0);
  });
});
