import { describe, expect, it } from 'vitest';
import { heap } from '@/algorithms/heap';
import { quickSort } from '@/algorithms/quick-sort';
import { presetInput, traceOf } from './trace';
import { ease, tweenScene } from './tween';

const bar = (scene: ReturnType<typeof traceOf>['scenes'][number], id: string) => scene.prims.get(id) as unknown as { x: number; y: number } | undefined;

describe('tweenScene', () => {
  const t = traceOf(quickSort, presetInput(quickSort, 'random'));
  const k = t.steps.findIndex((s) => s.events.some((e) => e.t === 'swap'));
  const [a, b] = [t.scenes[k], t.scenes[k + 1]];

  it('returns the exact scenes at the ends', () => {
    if (!a || !b) throw new Error('no swap step');
    expect(tweenScene(a, b, 0)).toBe(a);
    expect(tweenScene(a, b, 1)).toBe(b);
  });

  it('moves an element between its two slots by id, arcing on the way', () => {
    if (!a || !b) throw new Error('no swap step');
    const moved = [...b.prims.keys()].find((id) => id.startsWith('e:') && bar(a, id)?.x !== bar(b, id)?.x);
    if (!moved) throw new Error('nothing moved');
    const pa = bar(a, moved);
    const pb = bar(b, moved);
    const mid = bar(tweenScene(a, b, 0.5), moved);
    if (!pa || !pb || !mid) throw new Error('missing prim');
    expect(mid.x).toBeCloseTo((pa.x + pb.x) / 2);
    expect(mid.y).not.toBeCloseTo(pb.y);
  });

  it('keeps every id of the target scene from t = 0.5 on (heap array and tree)', () => {
    const h = traceOf(heap, presetInput(heap, 'insert-bubbles-to-root'));
    for (let i = 0; i + 1 < h.scenes.length; i++) {
      const s0 = h.scenes[i];
      const s1 = h.scenes[i + 1];
      if (!s0 || !s1) continue;
      const mid = tweenScene(s0, s1, 0.6);
      for (const id of s1.prims.keys()) expect(mid.prims.has(id)).toBe(true);
    }
  });

  it('eases from 0 to 1 monotonically', () => {
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = ease(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });
});
