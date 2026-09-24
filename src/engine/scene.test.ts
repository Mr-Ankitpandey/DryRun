import { describe, expect, it } from 'vitest';
import { binarySearch } from '@/algorithms/binary-search';
import { fixtures } from '@/render/fixtures';
import type { Fixture } from '@/render/fixtures';
import { computeLayout } from './layout';
import { pathOf } from './layout/tree';
import type { Run } from './run';
import { run } from './run';
import type { BarPrim, RowPrim, Scene, TNodePrim } from './scene';
import { CALLSTACK_PANEL, VARS_PANEL, buildScene, primsOf } from './scene';
import type { State } from './state';


/** Narrows away undefined/null in tests without non-null assertions. */
function must<T>(v: T | null | undefined, what = 'value'): T {
  if (v === null || v === undefined) throw new Error(`expected ${what}`);
  return v;
}

const VIEW = { width: 900 };

function runFixture(f: Fixture): Run {
  return run(f.initial, f.steps);
}

function scenesOf(r: Run): Scene[] {
  const layout = computeLayout(r, VIEW);
  return r.states.map((s) => buildScene(s, layout, VIEW));
}

const entries = (s: Scene) => [...s.prims.entries()];

const bsRun = run(binarySearch.initialState(must(binarySearch.presets[0]).input), binarySearch.generate(must(binarySearch.presets[0]).input));
const allRuns: [string, Run][] = [['binary-search', bsRun], ...Object.values(fixtures).map((f): [string, Run] => [f.id, runFixture(f)])];

describe('buildScene is pure and stable', () => {
  it('same state → deep-equal scene', () => {
    for (const [, r] of allRuns) {
      const layout = computeLayout(r, VIEW);
      for (const s of r.states) {
        expect(entries(buildScene(s, layout, VIEW))).toEqual(entries(buildScene(s, layout, VIEW)));
      }
    }
  });

  it('does not mutate the state', () => {
    for (const [, r] of allRuns) {
      const layout = computeLayout(r, VIEW);
      for (const s of r.states) {
        const before = JSON.stringify(s);
        buildScene(s, layout, VIEW);
        expect(JSON.stringify(s)).toBe(before);
      }
    }
  });

  it('untouched elements keep identical prims across steps (binary search never moves elements)', () => {
    const scenes = scenesOf(bsRun);
    for (let k = 1; k < scenes.length; k++) {
      const prev = must(scenes[k - 1]);
      const cur = must(scenes[k]);
      const st: State = must(bsRun.states[k]);
      const ps: State = must(bsRun.states[k - 1]);
      for (const bar of primsOf(cur, 'bar')) {
        const untouched = st.elements[bar.id] === ps.elements[bar.id] && !bar.read && !bar.compared && !(prev.prims.get(bar.id) as BarPrim).read && !(prev.prims.get(bar.id) as BarPrim).compared;
        if (untouched) expect(bar).toEqual(prev.prims.get(bar.id));
      }
    }
  });

  it('every prim id is unique and the map key equals the prim id', () => {
    for (const [, r] of allRuns) {
      for (const scene of scenesOf(r)) {
        const ids = new Set<string>();
        for (const [key, p] of scene.prims) {
          expect(key).toBe(p.id);
          expect(ids.has(p.id)).toBe(false);
          ids.add(p.id);
        }
      }
    }
  });

  it('stays within the 200-primitive budget at every step of every fixture', () => {
    for (const [name, r] of allRuns) {
      const max = Math.max(...scenesOf(r).map((s) => s.prims.size));
      expect(max, name).toBeLessThanOrEqual(200);
    }
  });
});

describe('arrays', () => {
  it('bars take x from the slot they occupy, so a swapped element keeps its id and moves', () => {
    const r = runFixture(must(fixtures['recursion']));
    const scenes = scenesOf(r);
    let swaps = 0;
    r.steps.forEach((step, k) => {
      const sw = step.events.find((e) => e.t === 'swap');
      if (!sw) return;
      const before = must(r.states[k]);
      const after = must(r.states[k + 1]);
      const idA = must(must(before.arrays['a']).slots[sw.a.i]);
      const idB = must(must(before.arrays['a']).slots[sw.b.i]);
      if (idA === idB) return;
      swaps++;
      const prevA = must(scenes[k]).prims.get(idA) as BarPrim;
      const prevB = must(scenes[k]).prims.get(idB) as BarPrim;
      const curA = must(scenes[k + 1]).prims.get(idA) as BarPrim;
      const curB = must(scenes[k + 1]).prims.get(idB) as BarPrim;
      expect(must(after.arrays['a']).slots[sw.b.i]).toBe(idA);
      expect(curA.x).toBe(prevB.x);
      expect(curB.x).toBe(prevA.x);
      expect(curA.index).toBe(sw.b.i);
      expect(curA.value).toBe(prevA.value);
    });
    expect(swaps).toBeGreaterThan(0);
  });

  it('regions are always emitted once declared; visible:false when the range is null', () => {
    const scenes = scenesOf(bsRun);
    const declaredAt = bsRun.steps.findIndex((s) => s.events.some((e) => e.t === 'region'));
    expect(declaredAt).toBeGreaterThanOrEqual(0);
    for (let k = declaredAt + 1; k < scenes.length; k++) {
      const left = must(scenes[k]).prims.get('r:elim-left');
      const right = must(scenes[k]).prims.get('r:elim-right');
      expect(left?.kind).toBe('region');
      expect(right?.kind).toBe('region');
      const st = must(bsRun.states[k]);
      if (left?.kind === 'region') expect(left.visible).toBe(must(st.regions['elim-left']).range !== null);
      if (right?.kind === 'region') {
        expect(right.visible).toBe(must(st.regions['elim-right']).range !== null);
        if (right.visible) {
          const [lo, hi] = must(must(st.regions['elim-right']).range);
          const bar = must(scenes[k]).prims.get(`e:${lo}`) as BarPrim;
          expect(right.x).toBeCloseTo(bar.x);
          expect(right.w).toBeCloseTo((hi - lo + 1) * bar.w);
        }
      }
    }
  });

  it('carets sit at the centre of their slot, including −1 and n', () => {
    const lower = must(binarySearch.presets.find((p) => p.id === 'lower-beyond'));
    const r = run(binarySearch.initialState(lower.input), binarySearch.generate(lower.input));
    const scenes = scenesOf(r);
    const last = must(scenes[scenes.length - 1]);
    const hi = last.prims.get('p:hi');
    const bar0 = last.prims.get('e:0') as BarPrim;
    expect(hi?.kind).toBe('caret');
    if (hi?.kind === 'caret') {
      expect(hi.visible).toBe(true);
      expect(hi.x).toBeCloseTo(bar0.x + 4 * bar0.w + bar0.w / 2);
    }
  });

  it('a compare against a variable becomes a link to the var row', () => {
    const scenes = scenesOf(bsRun);
    const k = bsRun.steps.findIndex((s) => s.events.some((e) => e.t === 'compare'));
    const scene = must(scenes[k + 1]);
    const links = primsOf(scene, 'link');
    expect(links).toHaveLength(1);
    expect(must(links[0]).style).toBe('compare');
    expect(must(links[0]).to).toBe('v:x');
    expect(must(links[0]).result).toBeTruthy();
    const bar = scene.prims.get(must(links[0]).from) as BarPrim;
    expect(bar.compared).toBe(true);
    expect(scene.prims.get('v:x')?.kind).toBe('row');
  });
});

describe('trees', () => {
  it('a node only moves when its path changes; a relinked node moves and others stay', () => {
    const r = runFixture(must(fixtures['tree']));
    const scenes = scenesOf(r);
    let relinkSteps = 0;
    for (let k = 1; k < scenes.length; k++) {
      const prev = must(r.states[k - 1]);
      const cur = must(r.states[k]);
      const step = must(r.steps[k - 1]);
      const relinked = new Set(step.events.filter((e) => e.t === 'node.relink' || e.t === 'node.detach').map((e) => (e as { id: string }).id));
      for (const node of primsOf(must(scenes[k]), 'tnode')) {
        const before = must(scenes[k - 1]).prims.get(node.id) as TNodePrim | undefined;
        if (!before) continue;
        const samePath = JSON.stringify(pathOf(prev, node.id)) === JSON.stringify(pathOf(cur, node.id)) && before.floating === node.floating;
        if (samePath) {
          expect(node.x, `${node.id} at step ${k}`).toBe(before.x);
          expect(node.y, `${node.id} at step ${k}`).toBe(before.y);
        }
      }
      if (relinkSteps === 0 && step.events.some((e) => e.t === 'node.relink')) {
        relinkSteps++;
        const id = must([...relinked][0]);
        const before = must(scenes[k - 1]).prims.get(id) as TNodePrim;
        const after = must(scenes[k]).prims.get(id) as TNodePrim;
        expect(after.x !== before.x || after.y !== before.y).toBe(true);
      }
    }
    expect(relinkSteps).toBe(1);
  });

  it('edges are keyed by the child and follow both endpoints', () => {
    const r = runFixture(must(fixtures['tree']));
    const scenes = scenesOf(r);
    const last = must(scenes[scenes.length - 1]);
    for (const e of primsOf(last, 'tedge')) {
      expect(e.id).toBe(`te:${e.child}`);
      const c = last.prims.get(e.child) as TNodePrim;
      const p = last.prims.get(e.parent) as TNodePrim;
      expect([e.x1, e.y1, e.x2, e.y2]).toEqual([c.x, c.y, p.x, p.y]);
    }
    // the removed nodes are gone
    expect(last.prims.has('n:14')).toBe(false);
    expect(last.prims.has('n:3')).toBe(false);
    expect(last.prims.has('te:n:14')).toBe(false);
  });

  it('a detached node floats in the lift row with its subtree', () => {
    const r = runFixture(must(fixtures['tree']));
    const scenes = scenesOf(r);
    const k = r.steps.findIndex((s) => s.events.some((e) => e.t === 'node.detach')) + 1;
    const scene = must(scenes[k]);
    const n14 = scene.prims.get('n:14') as TNodePrim;
    const n13 = scene.prims.get('n:13') as TNodePrim;
    const n8 = scene.prims.get('n:8') as TNodePrim;
    expect(n14.floating).toBe(true);
    expect(n13.floating).toBe(true);
    expect(n14.y).toBeLessThan(n8.y);
    expect(n13.y).toBeGreaterThan(n14.y);
    expect(scene.prims.get('te:n:13')?.kind).toBe('tedge');
  });
});

describe('graphs and panels', () => {
  const r = runFixture(must(fixtures['graph']));
  const scenes = scenesOf(r);

  it('graph nodes never move and edges join node centres', () => {
    const first = must(scenes[1]);
    for (const scene of scenes.slice(1)) {
      for (const n of primsOf(scene, 'gnode')) {
        const f = first.prims.get(n.id);
        expect(f?.kind).toBe('gnode');
        if (f?.kind === 'gnode') expect([n.x, n.y]).toEqual([f.x, f.y]);
      }
      for (const e of primsOf(scene, 'gedge')) {
        const a = scene.prims.get(e.a);
        const b = scene.prims.get(e.b);
        if (a?.kind === 'gnode' && b?.kind === 'gnode') expect([e.x1, e.y1, e.x2, e.y2]).toEqual([a.x, a.y, b.x, b.y]);
      }
    }
  });

  it('pq rows keep panel order, carry ref, and are stale when a skip targets them', () => {
    const skipK = r.steps.findIndex((s) => s.events.some((e) => e.t === 'skip') && !s.events.some((e) => e.t === 'pop')) + 1;
    const rows = primsOf(must(scenes[skipK]), 'row').filter((p) => p.panel === 'pq');
    expect(rows.map((p) => p.order)).toEqual(rows.map((_, i) => i));
    expect(rows.map((p) => p.key)).toEqual([...rows.map((p) => p.key)].sort((a, b) => (a ?? 0) - (b ?? 0)));
    const stale = rows.filter((p) => p.stale);
    expect(stale).toHaveLength(1);
    expect(must(stale[0]).id).toBe('q:5');
    expect(must(stale[0]).ref).toBe('n:3');
    // the row after the pop is gone
    expect(must(scenes[skipK + 1]).prims.has('q:5')).toBe(false);
  });

  it('labels and marks flow to gnode prims', () => {
    const last = must(scenes[scenes.length - 1]);
    const n4 = last.prims.get('n:4');
    expect(n4?.kind).toBe('gnode');
    if (n4?.kind === 'gnode') {
      expect(n4.text).toBe('7');
      expect(n4.mark).toBe('settled');
    }
  });
});

describe('grid', () => {
  it('emits every cell, marks the fresh one and links its dependencies', () => {
    const r = runFixture(must(fixtures['grid']));
    const scenes = scenesOf(r);
    for (const scene of scenes.slice(1)) expect(primsOf(scene, 'cell')).toHaveLength(12);
    const k = r.steps.findIndex((s) => s.events.some((e) => e.t === 'cell' && e.r === 1 && e.c === 1)) + 1;
    const scene = must(scenes[k]);
    const fresh = primsOf(scene, 'cell').filter((c) => c.fresh);
    expect(fresh.map((c) => c.id)).toEqual(['c:1,1']);
    const deps = primsOf(scene, 'link').filter((l) => l.style === 'dep');
    expect(deps.map((l) => l.from).sort()).toEqual(['c:0,1', 'c:1,0']);
    expect(scene.prims.get('c:2,3')).toMatchObject({ value: null });
    expect(scene.prims.get('c:0,1')).toMatchObject({ read: true });
  });
});

describe('recursion tree and call stack', () => {
  it('frames sit at the midpoint of their segment; call-stack rows mirror frameOrder', () => {
    const r = runFixture(must(fixtures['recursion']));
    const scenes = scenesOf(r);
    for (let k = 0; k < scenes.length; k++) {
      const st = must(r.states[k]);
      const scene = must(scenes[k]);
      const rows = primsOf(scene, 'row').filter((p) => p.panel === CALLSTACK_PANEL);
      expect(rows.map((p) => p.ref)).toEqual(st.frameOrder);
      for (const f of primsOf(scene, 'frame')) {
        const fr = must(st.frames[f.id]);
        const lo = fr.args['lo'] as number;
        const hi = fr.args['hi'] as number;
        if (lo <= hi) {
          const a = scene.prims.get(must(must(st.arrays['a']).slots[lo])) as BarPrim;
          const b = scene.prims.get(must(must(st.arrays['a']).slots[hi])) as BarPrim;
          expect(f.x).toBeCloseTo((a.x + b.x + b.w) / 2);
        }
        expect(f.active).toBe(st.frameOrder[st.frameOrder.length - 1] === f.id);
        expect(f.returned).toBe(fr.returned);
        if (fr.parent !== null) expect(scene.prims.get(`fe:${f.id}`)?.kind).toBe('fedge');
      }
    }
    const last = must(scenes[scenes.length - 1]);
    expect(primsOf(last, 'frame').length).toBeGreaterThan(3);
    const vars = primsOf(last, 'row').filter((p) => p.panel === VARS_PANEL) as RowPrim[];
    expect(vars.map((v) => v.label)).toContain('pivot');
  });
});
