import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import { computeLayout } from '@/engine/layout';
import { GRAPH_NODE_R, curvePoint } from '@/engine/layout/graph';
import { askIndices } from '@/engine/run';
import type { GEdgePrim } from '@/engine/scene';
import { buildScene, primsOf } from '@/engine/scene';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { TopoInput } from './index';
import { reference, topoSort } from './index';
import { findCycle, hasMultiParent, maxQueue } from './input';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);
const preset = (id: string): TopoInput => must(topoSort.presets.find((p) => p.id === id)).input;

/** Random DAGs: arcs only go forward in a random permutation of 0..n-1. */
const arb: fc.Arbitrary<TopoInput> = fc.integer({ min: 1, max: 10 }).chain((n) =>
  fc.tuple(fc.shuffledSubarray(Array.from({ length: n }, (_, i) => i), { minLength: n, maxLength: n }), fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1)), { maxLength: 30 })).map(([perm, raw]) => {
    const rank = new Map(perm.map((v, i) => [v, i]));
    const seen = new Set<string>();
    const arcs: { a: number; b: number }[] = [];
    for (const [x, y] of raw) {
      if (x === y) continue;
      const [a, b] = (rank.get(x) as number) < (rank.get(y) as number) ? [x, y] : [y, x];
      if (seen.has(`${a}>${b}`) || arcs.length >= 16) continue;
      seen.add(`${a}>${b}`);
      arcs.push({ a, b });
    }
    return { n, arcs };
  }),
);

describe('topological sort module', () => {
  it('passes every preset', () => {
    for (const p of topoSort.presets) checkAll(topoSort, p.input);
  });

  it('property: 1,000 random DAGs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(topoSort, arb, 1000);
  });

  it('the graph is directed and in the initial state; step 0 shows it with empty panels', () => {
    const s0 = must(runModule(topoSort, preset('diamond')).states[0]);
    expect(s0.graph?.directed).toBe(true);
    expect(s0.graph?.edges.map((e) => e.id)).toEqual(['a:0>1', 'a:0>2', 'a:1>3', 'a:2>3']);
    expect(s0.panels.queue).toEqual({ kind: 'queue', items: [] });
    expect(s0.panels.order).toEqual({ kind: 'queue', items: [] });
  });

  it('diamond: in-degrees, a removal per arc, 3 waits after the first arc and joins after the second', () => {
    const r = runModule(topoSort, preset('diamond'));
    expect(r.steps.map((s) => s.line)).toEqual([1, 2, 4, 6, 7, 6, 7, 4, 6, 7, 4, 6, 7, 4, 8]);
    expect(must(r.steps[0]).events).toEqual([
      { t: 'label', id: 'n:0', text: '0' },
      { t: 'label', id: 'n:1', text: '1' },
      { t: 'label', id: 'n:2', text: '1' },
      { t: 'label', id: 'n:3', text: '2' },
    ]);
    expect(must(r.steps[2]).ask).toMatchObject({ kind: 'pick', level: 'guided', answer: 'n:0', candidates: ['n:0', 'n:1', 'n:2', 'n:3'] });
    const pick = must(r.steps[2]).ask;
    if (pick?.kind === 'pick') expect(pick.distractors.map((d) => [d.answer, d.kind])).toEqual([['n:1', 'comparison']]);
    expect(must(r.steps[3]).events).toEqual([
      { t: 'edge.mark', id: 'a:0>1', as: 'rejected' },
      { t: 'label', id: 'n:1', text: '0' },
    ]);
    const drop = must(r.steps[3]).ask;
    expect(drop).toMatchObject({ kind: 'value', level: 'guided', answer: 0 });
    if (drop?.kind === 'value') expect(drop.distractors.map((d) => [d.answer, d.kind])).toEqual([[1, 'boundary']]);
    expect(must(r.steps[4]).ask).toMatchObject({ kind: 'choice', level: 'full', answer: 'yes' });
    // After 0: queue 1, 2 (the last enqueue asks for the queue contents).
    expect(must(r.steps[6]).ask).toMatchObject({ kind: 'order', answer: ['n:1', 'n:2'], pool: ['n:1', 'n:2'] });
    // 1 → 3 leaves 3 with one arc: it waits (a read beat, no push).
    expect(must(r.steps[8]).ask).toMatchObject({ kind: 'value', answer: 1 });
    expect(must(r.steps[9]).events).toEqual([{ t: 'read', ref: { id: 'n:3' } }]);
    expect(must(r.steps[9]).ask).toMatchObject({ kind: 'choice', answer: 'no' });
    expect(topoSort.result(lastState(r), preset('diamond'))).toEqual([0, 1, 2, 3]);
    expect(lastState(r).graph?.edges.every((e) => e.mark === 'rejected')).toBe(true);
  });

  it('dequeue pick: FIFO answer; back of the queue, smallest id and a blocked node as distractors', () => {
    // ids-in-order: after 1 is output the queue is [3, 2]: front 3, back 2 = smallest id.
    const r = runModule(topoSort, preset('ids-in-order'));
    const pick = r.steps.map((s) => s.ask).find((a) => a?.kind === 'pick' && a.answer === 'n:3');
    expect(pick?.prompt).toBe('Queue, front first: 3, 2. Which node is output next?');
    if (pick?.kind === 'pick') {
      expect(pick.candidates).toEqual(['n:2', 'n:3', 'n:4']);
      expect(pick.distractors.map((d) => [d.answer, d.kind])).toEqual([
        ['n:2', 'order'],
        ['n:4', 'comparison'],
      ]);
    }
    expect(topoSort.result(lastState(r), preset('ids-in-order'))).toEqual([0, 1, 3, 2, 4]);
  });

  it('two sources start together; the setup asks for the queue (full level)', () => {
    const r = runModule(topoSort, preset('two-sources'));
    const setup = must(r.steps[1]);
    expect(setup.events).toEqual([
      { t: 'mark', ref: { id: 'n:0' }, as: 'frontier' },
      { t: 'push', panel: 'queue', item: { id: 'q:0', ref: 'n:0', label: '0' } },
      { t: 'mark', ref: { id: 'n:1' }, as: 'frontier' },
      { t: 'push', panel: 'queue', item: { id: 'q:1', ref: 'n:1', label: '1' } },
    ]);
    expect(setup.ask).toMatchObject({ kind: 'order', level: 'full', answer: ['n:0', 'n:1'] });
  });

  it('single node: no arcs, one output, no question', () => {
    const r = runModule(topoSort, preset('single'));
    expect(r.steps.map((s) => s.line)).toEqual([1, 2, 4, 8]);
    expect(r.steps.every((s) => !s.ask)).toBe(true);
    expect(topoSort.result(lastState(r), preset('single'))).toEqual([0]);
  });

  it('every arc points right (longest-path columns) and never runs through another node, at any stage width', () => {
    const inputs = [...topoSort.presets.map((p) => p.input)];
    for (let i = 0; i < 150; i++) inputs.push(topoSort.randomInput(createRng(`lay-${i}`), i % 2 ? 'wide' : undefined));
    for (const input of inputs) {
      const r = runModule(topoSort, input);
      for (const width of [900, 600, 420]) {
        const layout = computeLayout(r, { width });
        const scene = buildScene(must(r.states[0]), layout, { width });
        const pos = must(layout.graph).pos;
        for (const e of primsOf(scene, 'gedge') as GEdgePrim[]) {
          expect(e.directed).toBe(true);
          const a = must(pos[e.a]);
          const b = must(pos[e.b]);
          expect(b.x).toBeGreaterThan(a.x);
          let closest = Infinity;
          for (let k = 1; k < 60; k++) {
            const p = curvePoint(a, b, e.bend ?? 0, k / 60);
            for (const [id, o] of Object.entries(pos)) if (id !== e.a && id !== e.b) closest = Math.min(closest, Math.hypot(p.x - o.x, p.y - o.y));
          }
          expect(closest, `${e.id} at ${width} (${JSON.stringify(input)})`).toBeGreaterThan(GRAPH_NODE_R + 2);
        }
      }
    }
  });

  it('every step and ask obeys the narration and ask rules on presets and random inputs', () => {
    const inputs = [...topoSort.presets.map((p) => p.input)];
    for (let i = 0; i < 60; i++) inputs.push(topoSort.randomInput(createRng(`n-${i}`)));
    for (const input of inputs) {
      const r = runModule(topoSort, input);
      for (const s of r.steps) {
        expect(s.note.length, s.note).toBeLessThanOrEqual(90);
        expect(s.note).not.toMatch(/\bwe\b/i);
        if (s.ask) {
          expect(s.ask.rule.length).toBeGreaterThan(0);
          expect(s.ask.prompt.length).toBeLessThanOrEqual(90);
          for (const d of s.ask.distractors) expect(d.rule.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('order asks: the answer is the queue after the step, the pool the same set by id', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = runModule(topoSort, input);
        r.steps.forEach((s, k) => {
          if (s.ask?.kind !== 'order') return;
          expect(s.ask.answer).toEqual(must(r.states[k + 1]).panels.queue?.items.map((it) => it.ref));
          expect([...s.ask.pool].sort()).toEqual([...s.ask.answer].sort());
        });
      }),
      { numRuns: 200 },
    );
  });

  it('guided asks exist on a typical preset', () => {
    expect(askIndices(runModule(topoSort, preset('diamond')).steps, 'guided').length).toBeGreaterThanOrEqual(6);
  });

  it('stays under the step cap; the worst case is exact', () => {
    // 2 setup steps + one dequeue per node + two steps per arc + the end.
    let max = 0;
    const consider = (input: TopoInput) => {
      const r = runModule(topoSort, input);
      expect(r.truncated).toBe(false);
      expect(r.steps.length).toBe(3 + input.n + 2 * input.arcs.length);
      max = Math.max(max, r.steps.length);
    };
    fc.assert(fc.property(arb, consider), { numRuns: 500, seed: 3 });
    const full: TopoInput = { n: 10, arcs: [] };
    for (let a = 0; a < 10 && full.arcs.length < 16; a++) for (let b = a + 1; b < 10 && full.arcs.length < 16; b++) full.arcs.push({ a, b });
    consider(full);
    expect(max).toBe(45);
    expect(max).toBeLessThanOrEqual(topoSort.meta.caps.maxSteps);
  });

  it('the scene builds for every state of every preset', () => {
    for (const p of topoSort.presets) {
      const r = runModule(topoSort, p.input);
      const layout = computeLayout(r);
      for (const s of r.states) buildScene(s, layout, { width: layout.width });
    }
  });

  it('random inputs are valid, acyclic, reproducible and hit their targets', () => {
    for (const target of [undefined, 'wide', 'multi-parent']) {
      for (let s = 0; s < 10; s++) {
        const a = topoSort.randomInput(createRng(`seed-${s}`), target);
        expect(topoSort.randomInput(createRng(`seed-${s}`), target)).toEqual(a);
        expect(topoSort.validate(topoSort.encode(a)).ok).toBe(true);
        expect(findCycle(a.n, a.arcs)).toBeNull();
        if (target === 'wide') expect(maxQueue(a)).toBeGreaterThanOrEqual(3);
        if (target === 'multi-parent') expect(hasMultiParent(a)).toBe(true);
        expect(reference(a)).toHaveLength(a.n);
        checkAll(topoSort, a);
      }
    }
  });

  it('validates with actionable sentences and names a cycle', () => {
    expect(topoSort.validate({ n: '3', g: '0>1,1>2,2>0' })).toEqual({ ok: false, error: 'These arcs form a cycle, 0 → 1 → 2 → 0, so no order exists: remove one of them.' });
    expect(topoSort.validate({ n: '2', g: '0>1,1>0' })).toEqual({ ok: false, error: 'These arcs form a cycle, 0 → 1 → 0, so no order exists: remove one of them.' });
    expect(topoSort.validate({ n: '2', g: '0-1' })).toEqual({ ok: false, error: 'Arcs look like a>b (a comes before b), separated by commas (got "0-1").' });
    expect(topoSort.validate({ n: '2', g: '1>1' })).toEqual({ ok: false, error: 'Arc 1>1 is a self-loop: a node cannot come before itself.' });
    expect(topoSort.validate({ n: '2', g: '0>1,0>1' })).toEqual({ ok: false, error: 'Arc 0>1 is listed twice: keep one copy.' });
    expect(topoSort.validate({ n: '3', g: '0>5' })).toEqual({ ok: false, error: 'Arc 0>5 uses a node outside 0–2.' });
    expect(topoSort.validate({ n: '11', g: '' })).toEqual({ ok: false, error: 'n must be between 1 and 10 (got 11).' });
    expect(topoSort.validate({ n: 'x', g: '' })).toMatchObject({ ok: false, error: expect.stringContaining('number of nodes') });
    const many = Array.from({ length: 17 }, (_, k) => `${Math.floor(k / 9)}>${(k % 9) + 1}`).join(',');
    expect(topoSort.validate({ n: '10', g: many })).toMatchObject({ ok: false });
    expect(topoSort.validate({ n: '3', g: '0>1,0>2' })).toEqual({ ok: true, input: { n: 3, arcs: [{ a: 0, b: 1 }, { a: 0, b: 2 }] } });
    expect(topoSort.encode({ n: 3, arcs: [{ a: 0, b: 1 }, { a: 0, b: 2 }] })).toEqual({ n: '3', g: '0>1,0>2' });
  });
});
