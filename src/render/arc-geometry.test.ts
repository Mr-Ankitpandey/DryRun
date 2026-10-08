import { describe, expect, it } from 'vitest';
import { arcGeometry, HEAD_LEN, RIM_GAP } from './arc-geometry';

describe('arc geometry', () => {
  it('a straight arc runs rim to rim and its head tip touches the target rim', () => {
    const g = arcGeometry({ x1: 0, y1: 0, x2: 100, y2: 0 }, 20);
    expect(g.d).toBe(`M${20 + RIM_GAP} 0 L${100 - 20 - RIM_GAP - HEAD_LEN + 1} 0`);
    expect(g.head.startsWith(`M${100 - 20 - RIM_GAP} 0`)).toBe(true);
    expect(g.mid).toEqual({ x: 50, y: 0 });
  });

  it('a bent arc is a quadratic whose head points along the curve end', () => {
    const g = arcGeometry({ x1: 0, y1: 0, x2: 100, y2: 0, bend: 40 }, 20);
    expect(g.d).toMatch(/^M[\d.-]+ [\d.-]+ Q50 40 /);
    expect(g.mid).toEqual({ x: 50, y: 20 });
  });
});
