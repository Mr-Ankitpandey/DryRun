/** `array.tree`: an array also drawn as its implicit binary tree (reducer,
 *  layout and scene). The tree nodes are keyed by the element they mirror, so
 *  a swap moves the same node in the tree as the bar in the array. */

import { describe, expect, it } from 'vitest';
import type { Step, VizEvent } from './events';
import { ids } from './ids';
import { computeLayout } from './layout';
import { crowdedLevel, depthOfSlot, layoutImplicitTree, parentSlot } from './layout/implicit-tree';
import { PAD } from './layout/constants';
import { applyEvent } from './reducer';
import { run } from './run';
import type { LinkPrim, TEdgePrim, TNodePrim } from './scene';
import { buildScene, primsOf } from './scene';
import { emptyState, withArray } from './state';

function must<T>(v: T | null | undefined, what = 'value'): T {
  if (v === null || v === undefined) throw new Error(`expected ${what}`);
  return v;
}

const W = 900;
const heap = (values: number[]) => applyEvent(withArray(emptyState(), 'a', values), { t: 'array.tree', arr: 'a' });
const step = (events: VizEvent[]): Step => ({ line: 1, events, note: 'test' });

describe('array.tree: reducer', () => {
  it('declares the view on an existing array and changes nothing else', () => {
    const before = withArray(emptyState(), 'a', [1, 2, 3]);
    const after = applyEvent(before, { t: 'array.tree', arr: 'a' });
    expect(after.implicitTree).toBe('a');
    expect(after.arrays).toBe(before.arrays);
    expect(after.elements).toBe(before.elements);
    expect(() => applyEvent(before, { t: 'array.tree', arr: 'nope' })).toThrow(/no array nope/);
  });

  it('states without the view are unchanged (no implicitTree key)', () => {
    expect('implicitTree' in emptyState()).toBe(false);
  });
});

describe('array.tree: layout', () => {
  it('slot i sits at depth floor(log2(i + 1)); levels split the width evenly', () => {
    const r = run(heap([5, 3, 8, 1, 4, 7, 9]), []);
    const lay = must(layoutImplicitTree(r, W, 0)).layout;
    expect(lay.pos).toHaveLength(7);
    expect(lay.depth).toBe(2);
    const inner = W - 2 * PAD;
    expect(must(lay.pos[0]).x).toBeCloseTo(PAD + inner / 2);
    expect(must(lay.pos[1]).x).toBeCloseTo(PAD + inner / 4);
    expect(must(lay.pos[2]).x).toBeCloseTo(PAD + (3 * inner) / 4);
    expect(must(lay.pos[3]).x).toBeCloseTo(PAD + inner / 8);
    for (let i = 1; i < 7; i++) {
      const p = must(lay.pos[i]);
      const parent = must(lay.pos[parentSlot(i)]);
      expect(p.y - parent.y).toBeCloseTo(lay.rowH);
      // A left child is left of its parent, a right child right of it.
      expect(Math.sign(p.x - parent.x)).toBe(i % 2 === 1 ? -1 : 1);
    }
  });

  it('is sized by the largest the array ever gets (an insert grows it)', () => {
    const r = run(heap([1, 2, 3]), [step([{ t: 'array', name: 'a', size: 4 }, { t: 'set', slot: { arr: 'a', i: 3 }, value: 0 }])]);
    const lay = must(computeLayout(r, { width: W }).implicitTree);
    expect(lay.pos).toHaveLength(4);
    expect(lay.depth).toBe(2);
  });

  it('sits right under the arrays and pushes later sections down', () => {
    const lay = computeLayout(run(heap([4, 6]), []), { width: W });
    const arr = must(lay.array);
    const it = must(lay.implicitTree);
    expect(must(it.pos[0]).y).toBeGreaterThan(must(arr.rows['a']).caretY);
    expect(lay.height).toBeGreaterThan(must(it.pos[1]).y);
  });

  it('helpers: depth, parent and the crowded level', () => {
    expect([0, 1, 2, 3, 6, 7, 14, 15].map(depthOfSlot)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
    expect([1, 2, 3, 4, 5, 6].map(parentSlot)).toEqual([0, 0, 1, 1, 2, 2]);
    expect([1, 2, 3, 4, 5, 8, 9, 15, 16].map(crowdedLevel)).toEqual([-1, -1, 1, 1, 2, 2, 3, 3, 3]);
  });

  it('no implicit tree without the declaration', () => {
    expect(computeLayout(run(withArray(emptyState(), 'a', [1, 2]), [])).implicitTree).toBeNull();
  });
});

describe('array.tree: scene', () => {
  it('one node per element at its slot, keyed h:<element>, with ref, value and mark', () => {
    const r = run(heap([2, 9, 4]), [step([{ t: 'mark', ref: { id: 'e:1' }, as: 'active' }])]);
    const layout = computeLayout(r, { width: W });
    const scene = buildScene(must(r.states[1]), layout, { width: W });
    const nodes = primsOf(scene, 'tnode');
    expect(nodes.map((n) => [n.id, n.ref, n.key, n.mark])).toEqual([
      ['h:e:0', 'e:0', 2, null],
      ['h:e:1', 'e:1', 9, 'active'],
      ['h:e:2', 'e:2', 4, null],
    ]);
    const it = must(layout.implicitTree);
    expect(nodes.map((n) => [n.x, n.y])).toEqual(it.pos.map((p) => [p.x, p.y]));
    const edges = primsOf(scene, 'tedge');
    expect(edges.map((e) => [e.id, e.child, e.parent])).toEqual([
      ['te:a[1]', 'h:e:1', 'h:e:0'],
      ['te:a[2]', 'h:e:2', 'h:e:0'],
    ]);
  });

  it('a swap moves the same node in the tree (object constancy); edges stay on their slots', () => {
    const r = run(heap([7, 3, 5]), [step([{ t: 'swap', a: { arr: 'a', i: 0 }, b: { arr: 'a', i: 1 } }])]);
    const layout = computeLayout(r, { width: W });
    const [s0, s1] = r.states.map((s) => buildScene(s, layout, { width: W }));
    const n0 = must(s0?.prims.get(ids.mirror('e:0'))) as TNodePrim;
    const n1 = must(s1?.prims.get(ids.mirror('e:0'))) as TNodePrim;
    const it = must(layout.implicitTree);
    expect([n0.x, n0.y]).toEqual([must(it.pos[0]).x, must(it.pos[0]).y]);
    expect([n1.x, n1.y]).toEqual([must(it.pos[1]).x, must(it.pos[1]).y]);
    const e0 = must(s0?.prims.get('te:a[1]')) as TEdgePrim;
    const e1 = must(s1?.prims.get('te:a[1]')) as TEdgePrim;
    expect([e1.x1, e1.y1, e1.x2, e1.y2]).toEqual([e0.x1, e0.y1, e0.x2, e0.y2]);
    expect(e1.child).toBe('h:e:0');
  });

  it('empty slots have no node and no edge; a removed element leaves the tree', () => {
    let s = heap([1, 2, 3]);
    s = applyEvent(s, { t: 'array', name: 'min', size: 1 });
    s = applyEvent(s, { t: 'move', id: 'e:0', to: { arr: 'min', i: 0 } });
    const r = run(s, []);
    const scene = buildScene(s, computeLayout(r, { width: W }), { width: W });
    expect(primsOf(scene, 'tnode').map((n) => n.id)).toEqual(['h:e:1', 'h:e:2']);
    expect(primsOf(scene, 'tedge')).toEqual([]);
    expect(scene.prims.get('e:0')?.kind).toBe('bar');
  });

  it('a compare shows in both views: flags on the mirrored nodes and a second bracket', () => {
    const r = run(heap([4, 8, 6]), [step([{ t: 'compare', a: { arr: 'a', i: 1 }, b: { arr: 'a', i: 2 }, result: '>' }])]);
    const scene = buildScene(must(r.states[1]), computeLayout(r, { width: W }), { width: W });
    const links = primsOf(scene, 'link') as LinkPrim[];
    expect(links.map((l) => [l.id, l.result])).toEqual([
      ['cmp:e:1:e:2', '>'],
      ['cmp:h:e:1:h:e:2', '>'],
    ]);
    const nodes = primsOf(scene, 'tnode');
    expect(nodes.filter((n) => n.compared).map((n) => n.id)).toEqual(['h:e:1', 'h:e:2']);
  });

  it('arrays without the declaration get no tree prims', () => {
    const s = withArray(emptyState(), 'a', [3, 1]);
    const scene = buildScene(s, computeLayout(run(s, [])), { width: W });
    expect(primsOf(scene, 'tnode')).toEqual([]);
  });
});
