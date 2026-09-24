import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import { askIndices } from '@/engine/run';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { DijkstraInput } from './index';
import { dijkstra, reference } from './index';
import { NEGATIVE_WEIGHT_ERROR, hasStalePop } from './input';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);

const arb: fc.Arbitrary<DijkstraInput> = fc.integer({ min: 1, max: 10 }).chain((n) => {
  const maxEdges = Math.min(18, (n * (n - 1)) / 2);
  const edge = fc
    .record({ a: fc.integer({ min: 0, max: n - 1 }), b: fc.integer({ min: 0, max: n - 1 }), w: fc.integer({ min: 1, max: 9 }) })
    .filter((e) => e.a !== e.b)
    .map((e) => (e.a < e.b ? e : { a: e.b, b: e.a, w: e.w }));
  return fc.record({
    n: fc.constant(n),
    edges: n < 2 ? fc.constant([]) : fc.uniqueArray(edge, { maxLength: maxEdges, selector: (e) => `${e.a}-${e.b}` }),
    s: fc.integer({ min: 0, max: n - 1 }),
  });
});

const stalePreset = must(dijkstra.presets.find((p) => p.id === 'stale-entry')).input;

describe('dijkstra module', () => {
  it('passes every preset', () => {
    for (const p of dijkstra.presets) checkAll(dijkstra, p.input);
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(dijkstra, arb, 1000);
  });

  it('reference: dist[s] = 0 and every finite dist is realised by an edge from a closer node', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const d = reference(input);
        expect(d[input.s]).toBe(0);
        d.forEach((dv, v) => {
          if (v === input.s || dv === Infinity) return;
          const ok = input.edges.some((e) => (e.a === v && (d[e.b] as number) + e.w === dv) || (e.b === v && (d[e.a] as number) + e.w === dv));
          expect(ok).toBe(true);
        });
      }),
    );
  });

  it('setup step declares the graph, the pq panel, ∞ labels and the (0, s) entry', () => {
    const r = runModule(dijkstra, stalePreset);
    const s1 = must(r.states[1]);
    expect(s1.graph?.nodes.map((n) => n.text)).toEqual(['0', '∞', '∞', '∞']);
    expect(s1.graph?.edges.map((e) => e.id)).toEqual(['g:0-1', 'g:0-2', 'g:1-2', 'g:1-3', 'g:2-3']);
    expect(s1.panels.pq?.items).toEqual([{ id: 'q:0', key: 0, tie: 0, ref: 'n:0', label: '(0, 0)' }]);
    expect(s1.vars['dist:1']).toBe('∞');
    expect(must(r.states[0]).graph).toBeNull();
  });

  it('stale-entry preset: (4, 1) pops stale with skip + stale mark for one step, then settled again', () => {
    const r = runModule(dijkstra, stalePreset);
    const k = r.steps.findIndex((s) => s.events.some((e) => e.t === 'skip'));
    expect(k).toBeGreaterThan(0);
    const staleStep = must(r.steps[k]);
    expect(staleStep.line).toBe(4);
    expect(staleStep.events).toEqual([
      { t: 'skip', ref: { id: 'n:1' }, reason: 'stale: dist already 3' },
      { t: 'mark', ref: { id: 'n:1' }, as: 'stale' },
    ]);
    expect(staleStep.ask).toMatchObject({ kind: 'choice', answer: 'yes', options: ['yes', 'no'] });
    const popStep = must(r.steps[k - 1]);
    expect(popStep.events[0]).toEqual({ t: 'pop', panel: 'pq', itemId: 'q:1' });
    const after = must(r.states[k + 1]);
    expect(after.graph?.nodes[1]?.mark).toBe('stale');
    const next = must(r.states[k + 2]);
    expect(next.graph?.nodes[1]?.mark).toBe('settled');
    expect(must(r.steps[k + 1]).events[0]).toEqual({ t: 'mark', ref: { id: 'n:1' }, as: 'settled' });
    expect(dijkstra.result(lastState(r), stalePreset)).toEqual([0, 3, 1, 4]);
  });

  it('pops are always the reducer minimum and the pick ask names the min (dist, id) node', () => {
    const r = runModule(dijkstra, stalePreset);
    r.steps.forEach((s, k) => {
      const ask = s.ask;
      if (!ask || ask.kind !== 'pick') return;
      const before = must(r.states[k]);
      const min = must(before.panels.pq?.items[0]);
      expect(ask.answer).toBe(min.ref);
      expect(ask.candidates).toEqual([...new Set(before.panels.pq?.items.map((it) => it.ref))]);
    });
    expect(askIndices(r.steps, 'guided').length).toBeGreaterThanOrEqual(4);
  });

  it('relaxation: value ask answers dist[u] + w with old-dist and w-alone distractors', () => {
    const input: DijkstraInput = { n: 4, edges: [{ a: 0, b: 1, w: 2 }, { a: 1, b: 3, w: 2 }, { a: 0, b: 2, w: 1 }, { a: 2, b: 3, w: 5 }], s: 0 };
    const r = runModule(dijkstra, input);
    const values = r.steps.filter((s) => s.ask?.kind === 'value');
    const improve = values.find((s) => s.note.startsWith('dist[3] = 4'));
    expect(improve?.ask).toMatchObject({ kind: 'value', answer: 4 });
    if (improve?.ask?.kind === 'value') {
      expect(improve.ask.distractors).toEqual([
        { answer: 6, kind: 'comparison', rule: expect.any(String) },
        { answer: 2, kind: 'dependency', rule: expect.any(String) },
      ]);
    }
    expect(improve?.events).toContainEqual({ t: 'edge.mark', id: 'g:2-3', as: null });
    expect(improve?.events).toContainEqual({ t: 'edge.mark', id: 'g:1-3', as: 'relaxed' });
    const final = lastState(r);
    expect(final.graph?.edges.map((e) => [e.id, e.mark])).toEqual([
      ['g:0-1', 'tree'],
      ['g:1-3', 'tree'],
      ['g:0-2', 'tree'],
      ['g:2-3', 'rejected'],
    ]);
  });

  it('final tree marks form the shortest-path tree on every preset and pq is empty', () => {
    for (const p of dijkstra.presets) {
      const r = runModule(dijkstra, p.input);
      const final = lastState(r);
      const dist = reference(p.input);
      const tree = must(final.graph).edges.filter((e) => e.mark === 'tree');
      const reachable = dist.filter((d) => d !== Infinity).length;
      expect(tree).toHaveLength(reachable - 1);
      expect(final.panels.pq?.items).toEqual([]);
      for (const gn of must(final.graph).nodes) {
        const v = Number(gn.label);
        expect(gn.mark).toBe(dist[v] === Infinity ? null : 'settled');
      }
    }
  });

  it('order ask lists queued nodes by (dist, id) with a reversed distractor', () => {
    const r = runModule(dijkstra, stalePreset);
    const order = r.steps.map((s) => s.ask).find((a) => a?.kind === 'order');
    expect(order).toMatchObject({ kind: 'order', level: 'full', answer: ['n:2', 'n:1'], pool: ['n:2', 'n:1'] });
    if (order?.kind === 'order') expect(order.distractors[0]?.answer).toEqual(['n:1', 'n:2']);
  });

  it('unreachable preset leaves ∞ labels and Infinity in the result', () => {
    const input = must(dijkstra.presets.find((p) => p.id === 'unreachable')).input;
    const r = runModule(dijkstra, input);
    expect(dijkstra.result(lastState(r), input)).toEqual([0, 2, 5, Infinity, Infinity]);
    expect(must(r.steps[r.steps.length - 1]).note).toContain('empty');
  });

  it('stays under the step cap on the densest inputs', () => {
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`dense-${i}`);
      const pairs: [number, number][] = [];
      for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) pairs.push([a, b]);
      const edges = rng
        .shuffle(pairs)
        .slice(0, 18)
        .map(([a, b]) => ({ a, b, w: rng.int(1, 9) }));
      const r = runModule(dijkstra, { n: 10, edges, s: rng.int(0, 9) });
      expect(r.truncated).toBe(false);
      expect(r.steps.length).toBeLessThanOrEqual(dijkstra.meta.caps.maxSteps);
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'stale', 'unreachable', 'connected']) {
      const a = dijkstra.randomInput(createRng('seed-1'), target);
      const b = dijkstra.randomInput(createRng('seed-1'), target);
      expect(a).toEqual(b);
      expect(dijkstra.validate(dijkstra.encode(a)).ok).toBe(true);
      const r = runModule(dijkstra, a);
      if (target === 'stale') {
        expect(hasStalePop(a)).toBe(true);
        expect(r.steps.some((s) => s.events.some((e) => e.t === 'skip'))).toBe(true);
      }
      if (target === 'unreachable') expect(reference(a)).toContain(Infinity);
      if (target === 'connected') expect(reference(a)).not.toContain(Infinity);
    }
    for (let i = 0; i < 20; i++) checkAll(dijkstra, dijkstra.randomInput(createRng(`s${i}`), 'stale'));
  });

  it('hasStalePop agrees with the generator on random inputs', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = runModule(dijkstra, input);
        expect(r.steps.some((s) => s.events.some((e) => e.t === 'skip'))).toBe(hasStalePop(input));
      }),
      { numRuns: 300 },
    );
  });

  it('rejects bad weights, self-loops, duplicates and out-of-range nodes with actionable errors', () => {
    expect(dijkstra.validate({ g: '0-1:-2', n: '2', s: '0' })).toEqual({ ok: false, error: NEGATIVE_WEIGHT_ERROR });
    expect(dijkstra.validate({ g: '0-1:0', n: '2', s: '0' })).toEqual({ ok: false, error: NEGATIVE_WEIGHT_ERROR });
    expect(dijkstra.validate({ g: '0-1:10', n: '2', s: '0' })).toMatchObject({ ok: false });
    expect(dijkstra.validate({ g: '1-1:3', n: '2', s: '0' })).toMatchObject({ ok: false, error: expect.stringContaining('self-loop') });
    expect(dijkstra.validate({ g: '0-1:3,1-0:2', n: '2', s: '0' })).toMatchObject({ ok: false, error: expect.stringContaining('twice') });
    expect(dijkstra.validate({ g: '0-5:3', n: '3', s: '0' })).toMatchObject({ ok: false });
    expect(dijkstra.validate({ g: '0-1:3', n: '2', s: '2' })).toMatchObject({ ok: false });
    expect(dijkstra.validate({ g: '0-1:3', n: '11', s: '0' })).toMatchObject({ ok: false });
    expect(dijkstra.validate({ g: '0-1', n: '2', s: '0' })).toMatchObject({ ok: false });
    expect(dijkstra.validate({ g: '', n: '1', s: '0' })).toEqual({ ok: true, input: { n: 1, edges: [], s: 0 } });
    expect(dijkstra.validate({ g: '0-1:4,0-2:1', n: '5', s: '0' })).toEqual({ ok: true, input: { n: 5, edges: [{ a: 0, b: 1, w: 4 }, { a: 0, b: 2, w: 1 }], s: 0 } });
    expect(dijkstra.encode({ n: 5, edges: [{ a: 0, b: 1, w: 4 }, { a: 0, b: 2, w: 1 }], s: 0 })).toEqual({ g: '0-1:4,0-2:1', n: '5', s: '0' });
  });
});
