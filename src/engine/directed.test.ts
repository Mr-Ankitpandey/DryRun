/** Directed graphs (`graph` with `directed: true`): reducer, longest-path
 *  layering, arc bends and the scene's arc prims. Undirected graphs must come
 *  out exactly as before (no new keys on their prims or layout). */

import { describe, expect, it } from 'vitest';
import type { Id, VizEvent } from './events';
import { ids } from './ids';
import { computeLayout } from './layout';
import { GRAPH_NODE_R, curvePoint, layoutGraphState, longestPathLayers } from './layout/graph';
import { applyEvent } from './reducer';
import { run } from './run';
import type { GEdgePrim } from './scene';
import { buildScene, primsOf } from './scene';
import type { GraphState } from './state';
import { emptyState } from './state';

function must<T>(v: T | null | undefined, what = 'value'): T {
  if (v === null || v === undefined) throw new Error(`expected ${what}`);
  return v;
}

const W = 900;
const nodes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: ids.node(i), label: String(i) }));
const arcs = (pairs: [number, number][]) => pairs.map(([a, b]) => ({ id: ids.arc(a, b), a: ids.node(a), b: ids.node(b) }));
const dag = (n: number, pairs: [number, number][]): VizEvent => ({ t: 'graph', nodes: nodes(n), edges: arcs(pairs), directed: true });
const graphOf = (ev: VizEvent): GraphState => must(applyEvent(emptyState(), ev).graph);

describe('directed graphs: reducer and ids', () => {
  it('ids.arc is ordered (a → b differs from b → a); ids.edge is unchanged', () => {
    expect(ids.arc(2, 5)).toBe('a:2>5');
    expect(ids.arc(5, 2)).toBe('a:5>2');
    expect(ids.edge(5, 2)).toBe('g:2-5');
  });

  it('stores the flag; undirected graphs have no directed key', () => {
    expect(graphOf(dag(2, [[0, 1]])).directed).toBe(true);
    const und = graphOf({ t: 'graph', nodes: nodes(2), edges: [{ id: ids.edge(0, 1), a: 'n:0', b: 'n:1' }] });
    expect('directed' in und).toBe(false);
  });

  it('rejects a duplicate arc; a reverse pair is two arcs', () => {
    expect(() => applyEvent(emptyState(), { t: 'graph', nodes: nodes(2), edges: [...arcs([[0, 1]]), ...arcs([[0, 1]])], directed: true })).toThrow(/duplicate arc/);
    expect(graphOf(dag(2, [[0, 1], [1, 0]])).edges).toHaveLength(2);
  });

  it('marks and labels work on arcs and nodes as on undirected graphs', () => {
    let s = applyEvent(emptyState(), dag(3, [[0, 1], [1, 2]]));
    s = applyEvent(s, { t: 'edge.mark', id: 'a:0>1', as: 'rejected' });
    s = applyEvent(s, { t: 'label', id: 'n:1', text: '0' });
    expect(s.graph?.edges[0]?.mark).toBe('rejected');
    expect(s.graph?.nodes[1]?.text).toBe('0');
  });
});

describe('directed graphs: layout', () => {
  it('columns follow the longest path from a source, so every arc points right', () => {
    // 0 → 1 → 2 → 3 and a skip arc 0 → 3: 3 sits in column 3, not 1.
    const g = graphOf(dag(4, [[0, 1], [1, 2], [2, 3], [0, 3]]));
    const depth = must(longestPathLayers(g, g.nodes.map((n) => n.id)));
    expect([...depth.entries()]).toEqual([
      ['n:0', 0],
      ['n:1', 1],
      ['n:2', 2],
      ['n:3', 3],
    ]);
    const lay = must(layoutGraphState(g, W, 0)).layout;
    for (const e of g.edges) expect(must(lay.pos[e.b]).x).toBeGreaterThan(must(lay.pos[e.a]).x);
  });

  it('a cycle falls back to the undirected layering', () => {
    const g = graphOf(dag(3, [[0, 1], [1, 2], [2, 0]]));
    expect(longestPathLayers(g, g.nodes.map((n) => n.id))).toBeNull();
    expect(Object.keys(must(layoutGraphState(g, W, 0)).layout.pos)).toHaveLength(3);
  });

  it('an arc that would pass through another node bends until it clears every node', () => {
    const g = graphOf(dag(4, [[0, 1], [1, 2], [2, 3], [0, 3]]));
    const lay = must(layoutGraphState(g, W, 0)).layout;
    const bend = must(lay.bend);
    expect(bend['a:0>1']).toBeUndefined();
    const h = must(bend['a:0>3']);
    expect(Math.abs(h)).toBeGreaterThan(0);
    const a = must(lay.pos['n:0']);
    const b = must(lay.pos['n:3']);
    for (let k = 1; k < 40; k++) {
      const p = curvePoint(a, b, h, k / 40);
      for (const id of ['n:1', 'n:2'] as Id[]) {
        const o = must(lay.pos[id]);
        expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeGreaterThan(GRAPH_NODE_R + 4);
      }
    }
  });

  it('a reverse twin pair bends to opposite sides', () => {
    const g = graphOf(dag(2, [[0, 1], [1, 0]]));
    const lay = must(layoutGraphState(g, W, 0)).layout;
    const ab = must(lay.bend?.['a:0>1']);
    const ba = must(lay.bend?.['a:1>0']);
    const a = must(lay.pos['n:0']);
    const b = must(lay.pos['n:1']);
    expect(Math.sign(curvePoint(a, b, ab, 0.5).y - a.y)).toBe(-Math.sign(curvePoint(b, a, ba, 0.5).y - a.y));
  });

  it('undirected layouts carry no bend map', () => {
    const g = graphOf({ t: 'graph', nodes: nodes(3), edges: [{ id: ids.edge(0, 1), a: 'n:0', b: 'n:1' }, { id: ids.edge(1, 2), a: 'n:1', b: 'n:2' }, { id: ids.edge(0, 2), a: 'n:0', b: 'n:2' }] });
    expect('bend' in must(layoutGraphState(g, W, 0)).layout).toBe(false);
  });
});

describe('directed graphs: scene', () => {
  it('arc prims carry directed and their bend; undirected edges gain no keys', () => {
    const r = run(applyEvent(emptyState(), dag(4, [[0, 1], [1, 2], [2, 3], [0, 3]])), []);
    const layout = computeLayout(r, { width: W });
    const scene = buildScene(must(r.states[0]), layout, { width: W });
    const edges = primsOf(scene, 'gedge');
    expect(edges.every((e) => e.directed === true)).toBe(true);
    expect((scene.prims.get('a:0>3') as GEdgePrim).bend).toBe(layout.graph?.bend?.['a:0>3']);
    expect('bend' in (scene.prims.get('a:0>1') as GEdgePrim)).toBe(false);
    const und = applyEvent(emptyState(), { t: 'graph', nodes: nodes(2), edges: [{ id: ids.edge(0, 1), a: 'n:0', b: 'n:1' }] });
    const uScene = buildScene(und, computeLayout(run(und, []), { width: W }), { width: W });
    expect(Object.keys(must(primsOf(uScene, 'gedge')[0])).sort()).toEqual(['a', 'b', 'id', 'kind', 'mark', 'w', 'x1', 'x2', 'y1', 'y2']);
  });
});
