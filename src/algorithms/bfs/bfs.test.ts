import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import { computeLayout } from '@/engine/layout';
import { askIndices } from '@/engine/run';
import { buildScene } from '@/engine/scene';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { BfsInput } from './index';
import { bfs, reference } from './index';
import { maxQueue } from './input';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);

const arb: fc.Arbitrary<BfsInput> = fc.integer({ min: 1, max: 12 }).chain((n) => {
  const maxEdges = Math.min(20, (n * (n - 1)) / 2);
  const edge = fc
    .record({ a: fc.integer({ min: 0, max: n - 1 }), b: fc.integer({ min: 0, max: n - 1 }) })
    .filter((e) => e.a !== e.b)
    .map((e) => (e.a < e.b ? e : { a: e.b, b: e.a }));
  return fc.record({
    n: fc.constant(n),
    edges: n < 2 ? fc.constant([]) : fc.uniqueArray(edge, { maxLength: maxEdges, selector: (e) => `${e.a}-${e.b}` }),
    s: fc.integer({ min: 0, max: n - 1 }),
  });
});

const preset = (id: string): BfsInput => must(bfs.presets.find((p) => p.id === id)).input;

describe('bfs module', () => {
  it('passes every preset', () => {
    for (const p of bfs.presets) checkAll(bfs, p.input);
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(bfs, arb, 1000);
  });

  it('tree-like: dequeue, discover, skip visited, and the asks in their places', () => {
    const r = runModule(bfs, preset('tree-like'));
    expect(r.steps.map((s) => s.line)).toEqual([1, 3, 6, 6, 3, 5, 6, 6, 3, 5, 6, 6, 3, 5, 3, 5, 3, 5, 3, 5, 2]);
    const setup = must(r.steps[0]);
    expect(setup.events.slice(1)).toEqual([
      { t: 'panel', panel: 'queue', kind: 'queue' },
      { t: 'label', id: 'n:0', text: '0' },
      { t: 'mark', ref: { id: 'n:0' }, as: 'frontier' },
      { t: 'push', panel: 'queue', item: { id: 'q:0', ref: 'n:0', label: '0' } },
    ]);
    expect(must(r.steps[1]).events).toEqual([
      { t: 'pop', panel: 'queue', itemId: 'q:0' },
      { t: 'mark', ref: { id: 'n:0' }, as: 'settled' },
      { t: 'var', name: 'u', value: 0 },
    ]);
    expect(must(r.steps[1]).ask).toBeUndefined(); // one node queued: nothing to choose
    const d1 = must(r.steps[2]);
    expect(d1.events).toEqual([
      { t: 'mark', ref: { id: 'n:1' }, as: 'frontier' },
      { t: 'label', id: 'n:1', text: '1' },
      { t: 'edge.mark', id: 'g:0-1', as: 'tree' },
      { t: 'push', panel: 'queue', item: { id: 'q:1', ref: 'n:1', label: '1' } },
    ]);
    expect(d1.ask).toMatchObject({ kind: 'value', level: 'full', answer: 1 });
    if (d1.ask?.kind === 'value') expect(d1.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([[0, 'boundary'], [2, 'boundary']]);
    expect(must(r.steps[3]).ask).toMatchObject({ kind: 'order', level: 'guided', answer: ['n:1', 'n:2'], pool: ['n:1', 'n:2'] });
    const deq = must(r.steps[4]).ask;
    expect(deq).toMatchObject({ kind: 'pick', level: 'guided', answer: 'n:1', candidates: ['n:1', 'n:2'] });
    if (deq?.kind === 'pick') expect(deq.distractors).toEqual([{ answer: 'n:2', kind: 'order', rule: expect.stringContaining('Queue, not stack') }]);
    expect(must(r.steps[5]).events).toEqual([{ t: 'read', ref: { id: 'n:0' } }]);
    const order = must(r.steps[7]).ask;
    expect(order).toMatchObject({ kind: 'order', answer: ['n:2', 'n:3', 'n:4'], pool: ['n:2', 'n:3', 'n:4'] });
    if (order?.kind === 'order') {
      expect(order.distractors.map((d) => d.answer)).toEqual([
        ['n:4', 'n:3', 'n:2'],
        ['n:3', 'n:4', 'n:2'],
        ['n:2', 'n:4', 'n:3'],
      ]);
      expect(order.distractors.every((d) => d.kind === 'order')).toBe(true);
    }
    expect(bfs.result(lastState(r), preset('tree-like'))).toEqual([0, 1, 1, 2, 2, 2, 2]);
    expect(must(r.steps[20]).note).toBe('The queue is empty: every node is reached and its dist is final.');
  });

  it('dequeue pick: FIFO answer, back of the queue and smallest id as order distractors', () => {
    // after 0: [5, 6, 7]; dequeue 5 pushes 1 and 8 → [6, 7, 1, 8]: front 6, back 8, smallest id 1
    const input: BfsInput = { n: 9, edges: [{ a: 0, b: 5 }, { a: 0, b: 6 }, { a: 0, b: 7 }, { a: 1, b: 5 }, { a: 5, b: 8 }], s: 0 };
    const r = runModule(bfs, input);
    const pick = r.steps.map((s) => s.ask).find((a) => a?.kind === 'pick' && a.answer === 'n:6');
    expect(pick).toMatchObject({ candidates: ['n:6', 'n:7', 'n:1', 'n:8'] });
    if (pick?.kind === 'pick') expect(pick.distractors.map((d) => [d.answer, d.kind])).toEqual([['n:8', 'order'], ['n:1', 'order']]);
  });

  it('cycle: the second wave reads an already-visited node instead of enqueueing it', () => {
    const r = runModule(bfs, preset('cycle'));
    const reads = r.steps.filter((s) => s.line === 5);
    expect(reads.map((s) => s.events)).toContainEqual([{ t: 'read', ref: { id: 'n:3' } }]);
    const pushes = r.steps.flatMap((s) => s.events.filter((e) => e.t === 'push'));
    expect(pushes).toHaveLength(6);
    expect(bfs.result(lastState(r), preset('cycle'))).toEqual([0, 1, 2, 3, 2, 1]);
  });

  it('disconnected: unreachable nodes stay unmarked and the final note names them', () => {
    const r = runModule(bfs, preset('disconnected'));
    const final = lastState(r);
    expect(must(r.steps[r.steps.length - 1]).note).toBe('The queue is empty: nodes 3, 4, 5 are unreachable from 0.');
    expect(final.graph?.nodes.map((x) => x.mark)).toEqual(['settled', 'settled', 'settled', null, null, null]);
    expect(bfs.result(final, preset('disconnected'))).toEqual([0, 1, 1, null, null, null]);
    expect(final.panels.queue?.items).toEqual([]);
  });

  it('every step and ask obeys the narration and ask rules on presets and random inputs', () => {
    const inputs = [...bfs.presets.map((p) => p.input)];
    for (let i = 0; i < 50; i++) inputs.push(bfs.randomInput(createRng(`n-${i}`)));
    for (const input of inputs) {
      const r = runModule(bfs, input);
      for (const s of r.steps) {
        expect(s.note.length).toBeLessThanOrEqual(90);
        expect(s.note).not.toMatch(/\bwe\b/i);
        if (s.ask) {
          expect(s.ask.rule.length).toBeGreaterThan(0);
          for (const d of s.ask.distractors) expect(d.rule.length).toBeGreaterThan(0);
        }
      }
    }
    const worst: BfsInput = { n: 12, edges: [], s: 0 };
    expect(must(runModule(bfs, worst).steps.at(-1)).note.length).toBeLessThanOrEqual(90);
  });

  it('order asks: the answer is the queue after the step, pool is the same set sorted by id', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = runModule(bfs, input);
        r.steps.forEach((s, k) => {
          if (s.ask?.kind !== 'order') return;
          const after = must(r.states[k + 1]).panels.queue?.items.map((it) => it.ref);
          expect(s.ask.answer).toEqual(after);
          expect([...s.ask.pool].sort()).toEqual([...s.ask.answer].sort());
        });
      }),
      { numRuns: 200 },
    );
  });

  it('guided asks exist on a typical preset', () => {
    expect(askIndices(runModule(bfs, preset('tree-like')).steps, 'guided').length).toBeGreaterThanOrEqual(6);
  });

  it('stays under the step cap on the densest inputs (12 nodes, 20 edges: 54 steps)', () => {
    let max = 0;
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`dense-${i}`);
      const pairs: [number, number][] = [];
      for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) pairs.push([a, b]);
      const edges = rng
        .shuffle(pairs)
        .slice(0, 20)
        .map(([a, b]) => ({ a, b }));
      const r = runModule(bfs, { n: 12, edges, s: rng.int(0, 11) });
      expect(r.truncated).toBe(false);
      expect(r.steps.length).toBeLessThanOrEqual(bfs.meta.caps.maxSteps);
      max = Math.max(max, r.steps.length);
    }
    expect(max).toBeLessThanOrEqual(54); // 1 setup + 12 dequeues + 2 × 20 edge scans + 1 final
  });

  it('the scene builds for every state of every preset', () => {
    for (const p of bfs.presets) {
      const r = runModule(bfs, p.input);
      const layout = computeLayout(r);
      for (const s of r.states) buildScene(s, layout, { width: layout.width });
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'connected', 'unreachable', 'wide']) {
      const a = bfs.randomInput(createRng('seed-1'), target);
      const b = bfs.randomInput(createRng('seed-1'), target);
      expect(a).toEqual(b);
      expect(bfs.validate(bfs.encode(a)).ok).toBe(true);
      if (target === 'connected') expect(reference(a)).not.toContain(null);
      if (target === 'unreachable') expect(reference(a)).toContain(null);
      if (target === 'wide') expect(maxQueue(a)).toBeGreaterThanOrEqual(3);
      checkAll(bfs, a);
    }
  });

  it('rejects weights, self-loops, duplicates and out-of-range nodes with actionable sentences', () => {
    expect(bfs.validate({ g: '0-1:3', n: '2', s: '0' })).toEqual({ ok: false, error: 'BFS edges have no weights: write 0-1, not 0-1:3.' });
    expect(bfs.validate({ g: '1-1', n: '2', s: '0' })).toMatchObject({ ok: false, error: expect.stringContaining('self-loop') });
    expect(bfs.validate({ g: '0-1,1-0', n: '2', s: '0' })).toEqual({ ok: false, error: 'Edge 1-0 is listed twice: keep one copy.' });
    expect(bfs.validate({ g: '0-5', n: '3', s: '0' })).toEqual({ ok: false, error: 'Edge 0-5 uses a node outside 0–2.' });
    expect(bfs.validate({ g: '0-1', n: '2', s: '2' })).toEqual({ ok: false, error: 'The start node must be between 0 and 1 (got 2).' });
    expect(bfs.validate({ g: '', n: '13', s: '0' })).toEqual({ ok: false, error: 'n must be between 1 and 12 (got 13).' });
    expect(bfs.validate({ g: '0;1', n: '2', s: '0' })).toMatchObject({ ok: false, error: expect.stringContaining('a-b') });
    const many = [...Array.from({ length: 11 }, (_, k) => `0-${k + 1}`), ...Array.from({ length: 10 }, (_, k) => `1-${k + 2}`)].join(',');
    expect(bfs.validate({ g: many, n: '12', s: '0' })).toEqual({ ok: false, error: 'Use at most 20 edges (got 21).' });
    expect(bfs.validate({ g: '', n: '1', s: '0' })).toEqual({ ok: true, input: { n: 1, edges: [], s: 0 } });
    expect(bfs.validate({ g: '0-1,0-2', n: '5', s: '0' })).toEqual({ ok: true, input: { n: 5, edges: [{ a: 0, b: 1 }, { a: 0, b: 2 }], s: 0 } });
    expect(bfs.encode({ n: 5, edges: [{ a: 0, b: 1 }, { a: 0, b: 2 }], s: 0 })).toEqual({ g: '0-1,0-2', n: '5', s: '0' });
  });
});
