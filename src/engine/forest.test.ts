/** `forest`: a tree with several roots and n-ary children by parent pointer
 *  (union-find). Reducer rules, the tidy side-by-side layout and the scene.
 *  The BST path (one root, left/right sides) must be unaffected. */

import { describe, expect, it } from 'vitest';
import type { Step, VizEvent } from './events';
import { computeLayout } from './layout';
import { forestPositions, layoutForest } from './layout/forest';
import { applyEvent } from './reducer';
import { run } from './run';
import type { TEdgePrim, TNodePrim } from './scene';
import { buildScene, primsOf } from './scene';
import type { State } from './state';
import { emptyState } from './state';

function must<T>(v: T | null | undefined, what = 'value'): T {
  if (v === null || v === undefined) throw new Error(`expected ${what}`);
  return v;
}

const W = 900;
const ev = (s: State, e: VizEvent) => applyEvent(s, e);
const step = (events: VizEvent[]): Step => ({ line: 1, events, note: 'test' });
/** n singleton roots n:0 .. n:(n-1). */
function forest(n: number): State {
  let s = ev(emptyState(), { t: 'forest' });
  for (let i = 0; i < n; i++) s = ev(s, { t: 'node.add', id: `n:${i}`, key: i, parent: null, side: null });
  return s;
}

describe('forest: reducer', () => {
  it('holds several roots; state.root stays null', () => {
    const s = forest(3);
    expect(s.forest).toBe(true);
    expect(s.root).toBeNull();
    expect(Object.values(s.tree).map((n) => n.parent)).toEqual([null, null, null]);
  });

  it('relink with side null attaches under any number of children, by parent pointer only', () => {
    let s = forest(4);
    s = ev(s, { t: 'node.relink', id: 'n:1', parent: 'n:0', side: null });
    s = ev(s, { t: 'node.relink', id: 'n:2', parent: 'n:0', side: null });
    s = ev(s, { t: 'node.relink', id: 'n:3', parent: 'n:0', side: null });
    expect(['n:1', 'n:2', 'n:3'].map((id) => s.tree[id]?.parent)).toEqual(['n:0', 'n:0', 'n:0']);
    expect(s.tree['n:0']).toMatchObject({ left: null, right: null, parent: null });
    // Path compression: a grandchild moves straight under the root.
    s = ev(s, { t: 'node.relink', id: 'n:3', parent: 'n:1', side: null });
    s = ev(s, { t: 'node.relink', id: 'n:3', parent: 'n:0', side: null });
    expect(s.tree['n:3']?.parent).toBe('n:0');
    // A relink to null makes it a root again.
    s = ev(s, { t: 'node.relink', id: 'n:2', parent: null, side: null });
    expect(s.tree['n:2']?.parent).toBeNull();
  });

  it('rejects sides, cycles, unknown parents and removing a node with children', () => {
    let s = forest(3);
    expect(() => ev(s, { t: 'node.relink', id: 'n:1', parent: 'n:0', side: 'L' })).toThrow(/no side/);
    s = ev(s, { t: 'node.relink', id: 'n:1', parent: 'n:0', side: null });
    s = ev(s, { t: 'node.relink', id: 'n:2', parent: 'n:1', side: null });
    expect(() => ev(s, { t: 'node.relink', id: 'n:0', parent: 'n:2', side: null })).toThrow(/cycle/);
    expect(() => ev(s, { t: 'node.relink', id: 'n:0', parent: 'n:0', side: null })).toThrow(/cycle/);
    expect(() => ev(s, { t: 'node.relink', id: 'n:0', parent: 'n:9', side: null })).toThrow(/unknown parent/);
    expect(() => ev(s, { t: 'node.remove', id: 'n:1' })).toThrow(/children/);
    expect(ev(s, { t: 'node.remove', id: 'n:2' }).tree['n:2']).toBeUndefined();
  });

  it('cannot switch a tree that already has a root; BST trees never get the flag', () => {
    const bst = ev(emptyState(), { t: 'node.add', id: 'n:5', key: 5, parent: null, side: null });
    expect(() => ev(bst, { t: 'forest' })).toThrow(/already has a root/);
    expect('forest' in bst).toBe(false);
    expect(() => ev(bst, { t: 'node.add', id: 'n:6', key: 6, parent: null, side: null })).toThrow(/root already/);
  });

  it('label writes text under a tree node; graph labels are unchanged', () => {
    let s = forest(2);
    s = ev(s, { t: 'label', id: 'n:0', text: 'rank 1' });
    expect(s.tree['n:0']?.text).toBe('rank 1');
    s = ev(s, { t: 'label', id: 'n:0', text: null });
    expect(s.tree['n:0']?.text).toBeNull();
    expect('text' in must(s.tree['n:1'])).toBe(false);
    expect(() => ev(s, { t: 'label', id: 'n:9', text: 'x' })).toThrow(/no graph/);
  });
});

describe('forest: layout', () => {
  it('singletons take one column each, roots side by side in id order', () => {
    const r = run(forest(4), []);
    const lay = must(layoutForest(r, W, 0)).layout;
    expect(lay.n).toBe(4);
    const pos = forestPositions(must(r.states[0]), lay);
    const xs = ['n:0', 'n:1', 'n:2', 'n:3'].map((id) => must(pos.get(id)).x);
    for (let i = 1; i < 4; i++) expect(must(xs[i]) - must(xs[i - 1])).toBeCloseTo(lay.colW);
    expect(new Set(['n:0', 'n:1', 'n:2', 'n:3'].map((id) => must(pos.get(id)).y)).size).toBe(1);
  });

  it('a single child hangs straight below; siblings spread under their root; spans never collide', () => {
    let s = forest(6);
    for (const [c, p] of [['n:1', 'n:0'], ['n:2', 'n:1'], ['n:4', 'n:3'], ['n:5', 'n:3']] as const) s = ev(s, { t: 'node.relink', id: c, parent: p, side: null });
    const r = run(s, []);
    const lay = must(layoutForest(r, W, 0)).layout;
    expect(lay.depth).toBe(2);
    const pos = forestPositions(s, lay);
    const at = (id: string) => must(pos.get(id));
    expect(at('n:1').x).toBeCloseTo(at('n:0').x);
    expect(at('n:2').x).toBeCloseTo(at('n:1').x);
    expect(at('n:1').y - at('n:0').y).toBeCloseTo(lay.rowH);
    expect(at('n:4').x).toBeLessThan(at('n:3').x);
    expect(at('n:5').x).toBeGreaterThan(at('n:3').x);
    const all = [...pos.values()];
    for (const a of all) for (const b of all) if (a !== b && a.y === b.y) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(lay.colW - 1e-9);
  });

  it('is sized once per run by every node and the deepest state; the BST layout steps aside', () => {
    const s = forest(3);
    const r = run(s, [step([{ t: 'node.relink', id: 'n:1', parent: 'n:0', side: null }]), step([{ t: 'node.relink', id: 'n:2', parent: 'n:1', side: null }])]);
    const lay = computeLayout(r, { width: W });
    expect(lay.tree).toBeNull();
    expect(must(lay.forest).depth).toBe(2);
    expect(computeLayout(run(ev(emptyState(), { t: 'node.add', id: 'n:1', key: 1, parent: null, side: null }), [])).forest).toBeNull();
  });
});

describe('forest: scene', () => {
  it('one node per tree node with its text; edges keyed by the child', () => {
    let s = forest(3);
    s = ev(s, { t: 'node.relink', id: 'n:2', parent: 'n:0', side: null });
    s = ev(s, { t: 'label', id: 'n:0', text: 'rank 1' });
    const scene = buildScene(s, computeLayout(run(s, []), { width: W }), { width: W });
    const nodes = primsOf(scene, 'tnode');
    expect(nodes.map((n) => [n.id, n.text ?? null])).toEqual([
      ['n:0', 'rank 1'],
      ['n:1', null],
      ['n:2', null],
    ]);
    expect(primsOf(scene, 'tedge').map((e) => [e.id, e.child, e.parent])).toEqual([['te:n:2', 'n:2', 'n:0']]);
  });

  it('a relink moves the same node prim and its edge follows (object constancy)', () => {
    let s = forest(3);
    s = ev(s, { t: 'node.relink', id: 'n:1', parent: 'n:0', side: null });
    s = ev(s, { t: 'node.relink', id: 'n:2', parent: 'n:1', side: null });
    const r = run(s, [step([{ t: 'node.relink', id: 'n:2', parent: 'n:0', side: null }])]);
    const layout = computeLayout(r, { width: W });
    const [a, b] = r.states.map((st) => buildScene(st, layout, { width: W }));
    const before = must(a?.prims.get('n:2')) as TNodePrim;
    const after = must(b?.prims.get('n:2')) as TNodePrim;
    expect(after.y).toBeLessThan(before.y);
    const edge = must(b?.prims.get('te:n:2')) as TEdgePrim;
    expect(edge.parent).toBe('n:0');
    expect([edge.x1, edge.y1]).toEqual([after.x, after.y]);
  });
});
