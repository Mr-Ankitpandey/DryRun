import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import { ids } from '@/engine/ids';
import { computeLayout } from '@/engine/layout';
import { askIndices } from '@/engine/run';
import type { BarPrim, TNodePrim } from '@/engine/scene';
import { buildScene } from '@/engine/scene';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { HeapInput, HeapResult } from './index';
import { heap, reference } from './index';
import { heapify, isMinHeap, runOp } from './model';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);
const preset = (id: string): HeapInput => must(heap.presets.find((p) => p.id === id)).input;

const value = fc.integer({ min: 0, max: 99 });
const small = fc.integer({ min: 0, max: 6 });
const arb: fc.Arbitrary<HeapInput> = fc.oneof(
  fc.record({ a: fc.array(fc.oneof(value, small), { maxLength: 14 }).map(heapify), op: fc.constant('insert' as const), x: fc.oneof(value, small) }),
  fc.record({ a: fc.array(fc.oneof(value, small), { maxLength: 15 }).map(heapify), op: fc.constant('extract' as const), x: fc.constant(0) }),
  fc.record({ a: fc.array(fc.oneof(value, small), { maxLength: 15 }), op: fc.constant('build' as const), x: fc.constant(0) }),
);

describe('heap module', () => {
  it('passes every preset', () => {
    for (const p of heap.presets) checkAll(heap, p.input);
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(heap, arb, 1000);
  });

  it('insert: the new value is minted in a[n] and rises to the root, one swap per level', () => {
    const input = preset('insert-bubbles-to-root');
    const r = runModule(heap, input);
    expect(r.steps.map((s) => s.line)).toEqual([2, 4, 5, 6, 4, 5, 6, 4, 5, 6, 3]);
    const id = ids.elIn('a', 7, 1);
    expect(must(r.steps[0]).events).toEqual([
      { t: 'var', name: 'x', value: 1 },
      { t: 'array', name: 'a', size: 8 },
      { t: 'set', slot: { arr: 'a', i: 7 }, value: 1 },
      { t: 'mark', ref: { id }, as: 'active' },
      { t: 'pointer', name: 'i', at: { arr: 'a', i: 7 } },
      { t: 'var', name: 'n', value: 8 },
      { t: 'var', name: 'i', value: 7 },
    ]);
    expect(must(r.states[1]).arrays.a?.slots[7]).toBe(id);
    expect(must(r.steps[1]).ask).toMatchObject({ kind: 'value', level: 'full', answer: 3 });
    const parent = must(r.steps[1]).ask;
    if (parent?.kind === 'value') expect(parent.distractors.map((d) => [d.answer, d.kind])).toEqual([[6, 'boundary'], [15, 'boundary']]);
    expect(must(r.steps[2]).ask).toMatchObject({ kind: 'choice', level: 'guided', answer: 'yes', options: ['yes', 'no'] });
    expect(must(r.steps[3]).events[0]).toEqual({ t: 'swap', a: { arr: 'a', i: 7 }, b: { arr: 'a', i: 3 } });
    const root = must(r.steps[10]);
    expect(root.ask).toMatchObject({ kind: 'choice', answer: 'no' });
    if (root.ask?.kind === 'choice') expect(root.ask.distractors).toEqual([{ answer: 'yes', kind: 'base-case', rule: expect.stringContaining('root') }]);
    expect(must(lastState(r).arrays.a).slots[0]).toBe(id);
    expect(heap.result(lastState(r), input)).toEqual({ heap: [1, 2, 3, 5, 9, 4, 7, 8], extracted: null });
  });

  it('insert: an equal parent stops the climb (comparison distractor names equality)', () => {
    const r = runModule(heap, preset('insert-equal-parent'));
    const decide = r.steps.find((s) => s.line === 5);
    expect(decide?.ask).toMatchObject({ kind: 'choice', answer: 'no' });
    if (decide?.ask?.kind === 'choice') expect(decide.ask.distractors).toEqual([{ answer: 'yes', kind: 'comparison', rule: expect.stringContaining('Equal') }]);
    expect(decide?.events[0]).toMatchObject({ t: 'compare', result: '=' });
  });

  it('extract: take the root, the last element fills it, then sinks along the smaller child', () => {
    const input = preset('extract-sinks-right');
    const r = runModule(heap, input);
    expect(r.steps.map((s) => s.line)).toEqual([3, 4, 10, 11, 12, 10, 11, 12, 8, 14]);
    const take = must(r.steps[0]);
    expect(take.events[0]).toEqual({ t: 'move', id: 'e:0', to: { arr: 'min', i: 0 } });
    expect(take.ask).toMatchObject({ kind: 'pick', level: 'guided', answer: 'e:0' });
    if (take.ask?.kind === 'pick') expect(take.ask.distractors).toEqual([{ answer: 'e:7', kind: 'order', rule: expect.any(String) }]);
    const fill = must(r.steps[1]);
    expect(fill.events.slice(0, 2)).toEqual([
      { t: 'move', id: 'e:7', to: { arr: 'a', i: 0 } },
      { t: 'array', name: 'a', size: 7 },
    ]);
    expect(fill.ask).toMatchObject({ kind: 'choice', level: 'full', answer: 'a[7]', options: ['a[1]', 'a[2]', 'a[7]'] });
    const pick = must(r.steps[2]).ask;
    expect(pick).toMatchObject({ kind: 'pick', level: 'guided', answer: 'e:2', candidates: ['e:1', 'e:2'] });
    if (pick?.kind === 'pick') expect(pick.distractors.map((d) => [d.answer, d.kind])).toEqual([['e:1', 'comparison']]);
    expect(must(r.steps[8]).ask).toMatchObject({ kind: 'choice', answer: 'no' });
    expect(heap.result(lastState(r), input)).toEqual({ heap: [2, 5, 3, 6, 7, 4, 9], extracted: 1 });
  });

  it('extract with equal children keeps the left one; the tie distractor says so', () => {
    const r = runModule(heap, preset('duplicates'));
    const pick = must(r.steps[2]).ask;
    expect(must(r.steps[2]).events[0]).toEqual({ t: 'compare', a: { id: 'e:2' }, b: { id: 'e:1' }, result: '=' });
    expect(pick).toMatchObject({ kind: 'pick', answer: 'e:1' });
    if (pick?.kind === 'pick') expect(pick.distractors).toEqual([{ answer: 'e:2', kind: 'comparison', rule: expect.stringContaining('left one is kept') }]);
  });

  it('extract from one value and from an empty heap', () => {
    const one = runModule(heap, preset('single'));
    expect(one.steps.map((s) => s.line)).toEqual([3, 14]);
    expect(heap.result(lastState(one), preset('single'))).toEqual({ heap: [], extracted: 5 });
    expect(lastState(one).arrays.a?.slots).toEqual([]);
    const empty = runModule(heap, preset('empty-extract'));
    expect(empty.steps).toHaveLength(1);
    expect(must(empty.steps[0]).note).toBe('The heap is empty (n = 0): there is nothing to extract.');
    expect(heap.result(lastState(empty), preset('empty-extract'))).toEqual({ heap: [], extracted: null });
  });

  it('build: starts at the last parent, grows the heaps region, and ends with a heap', () => {
    const input = preset('build-reverse');
    const r = runModule(heap, input);
    const first = must(r.steps[0]);
    expect(first.ask).toMatchObject({ kind: 'pick', level: 'full', answer: 'e:3' });
    if (first.ask?.kind === 'pick') {
      expect(first.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([
        ['e:4', 'boundary'],
        ['e:8', 'boundary'],
        ['e:0', 'order'],
      ]);
    }
    expect(must(r.states[1]).regions.heaps).toEqual({ kind: 'ordered', arr: 'a', range: [4, 8] });
    expect(lastState(r).regions.heaps).toEqual({ kind: 'ordered', arr: 'a', range: [0, 8] });
    const final = heap.result(lastState(r), input) as HeapResult;
    expect(isMinHeap(final.heap)).toBe(true);
    expect(final).toEqual(reference(input));
    const sorted = runModule(heap, preset('build-sorted'));
    expect(sorted.steps.filter((s) => s.events.some((e) => e.t === 'swap'))).toHaveLength(0);
  });

  it('every swap moves the same element in both views: bar and mirrored tree node land on the new slot', () => {
    const inputs = [...heap.presets.map((p) => p.input)];
    for (let i = 0; i < 30; i++) inputs.push(heap.randomInput(createRng(`views-${i}`)));
    for (const input of inputs) {
      const r = runModule(heap, input);
      const layout = computeLayout(r, { width: 900 });
      const it = layout.implicitTree;
      r.steps.forEach((s, k) => {
        for (const ev of s.events) {
          if (ev.t !== 'swap') continue;
          const before = must(r.states[k]);
          const after = buildScene(must(r.states[k + 1]), layout, { width: 900 });
          const moved = must(before.arrays.a?.slots[ev.a.i]);
          const bar = after.prims.get(moved) as BarPrim;
          const node = after.prims.get(ids.mirror(moved)) as TNodePrim;
          expect(bar.index).toBe(ev.b.i);
          expect([node.x, node.y]).toEqual([must(it?.pos[ev.b.i]).x, must(it?.pos[ev.b.i]).y]);
          expect(node.ref).toBe(moved);
        }
      });
    }
  });

  it('every step and ask obeys the narration and ask rules on presets and random inputs', () => {
    const inputs = [...heap.presets.map((p) => p.input)];
    for (let i = 0; i < 60; i++) inputs.push(heap.randomInput(createRng(`n-${i}`)));
    inputs.push({ a: [99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99], op: 'insert', x: 99 });
    inputs.push({ a: Array.from({ length: 15 }, (_, k) => 99 - k), op: 'build', x: 0 });
    for (const input of inputs) {
      const r = runModule(heap, input);
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

  it('guided asks exist on every operation', () => {
    for (const id of ['insert-bubbles-to-root', 'extract-sinks-left', 'build-reverse']) {
      expect(askIndices(runModule(heap, preset(id)).steps, 'guided').length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it('stays under the step cap; the worst cases are measured', () => {
    // Longest runs: build on 15 values sinking every parent as far as it goes,
    // extract with a 4-level sink, insert of a new minimum at depth 3.
    let max = 0;
    const consider = (input: HeapInput) => {
      const r = runModule(heap, input);
      expect(r.truncated).toBe(false);
      max = Math.max(max, r.steps.length);
    };
    consider({ a: Array.from({ length: 15 }, (_, k) => 99 - k), op: 'build', x: 0 });
    consider({ a: Array.from({ length: 14 }, (_, k) => k + 1), op: 'insert', x: 0 });
    consider({ a: Array.from({ length: 15 }, (_, k) => k), op: 'extract', x: 0 });
    fc.assert(
      fc.property(arb, (input) => {
        consider(input);
      }),
      { numRuns: 2000, seed: 11 },
    );
    for (let i = 0; i < 300; i++) consider(heap.randomInput(createRng(`cap-${i}`), 'deep'));
    expect(max).toBeLessThanOrEqual(heap.meta.caps.maxSteps);
    expect(max).toBe(MEASURED_MAX);
  });

  it('the scene builds for every state of every preset', () => {
    for (const p of heap.presets) {
      const r = runModule(heap, p.input);
      const layout = computeLayout(r);
      for (const s of r.states) buildScene(s, layout, { width: layout.width });
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'insert', 'extract', 'build', 'ties', 'deep']) {
      for (let s = 0; s < 10; s++) {
        const a = heap.randomInput(createRng(`seed-${s}`), target);
        const b = heap.randomInput(createRng(`seed-${s}`), target);
        expect(a).toEqual(b);
        expect(heap.validate(heap.encode(a)).ok).toBe(true);
        if (target === 'insert' || target === 'extract' || target === 'build') expect(a.op).toBe(target);
        if (target === 'ties') expect(runOp(a).stats.tie).toBe(true);
        if (target === 'deep') expect(runOp(a).stats).toMatchObject({ end: true, longest: expect.any(Number) });
        if (target === 'deep') expect(runOp(a).stats.longest).toBeGreaterThanOrEqual(2);
        checkAll(heap, a);
      }
    }
  });

  it('validates with actionable sentences', () => {
    expect(heap.validate({ i: '1,3,2', op: 'insert', x: '0' })).toEqual({ ok: true, input: { a: [1, 3, 2], op: 'insert', x: 0 } });
    expect(heap.validate({ i: '5,3', op: 'extract', x: '0' })).toEqual({ ok: false, error: 'Not a min-heap: a[1] = 3 is smaller than its parent a[0] = 5. Use build to heapify it first.' });
    expect(heap.validate({ i: '5,3', op: 'build', x: '0' })).toEqual({ ok: true, input: { a: [5, 3], op: 'build', x: 0 } });
    expect(heap.validate({ i: '5,3', op: 'build' })).toEqual({ ok: true, input: { a: [5, 3], op: 'build', x: 0 } });
    expect(heap.validate({ i: '1,2', op: 'insert', x: '' })).toEqual({ ok: false, error: 'Enter a whole number for the value to insert.' });
    expect(heap.validate({ i: '1,2', op: 'insert', x: '100' })).toEqual({ ok: false, error: 'The value to insert must be between 0 and 99.' });
    expect(heap.validate({ i: '1,2', op: 'pop', x: '1' })).toEqual({ ok: false, error: 'Choose an operation: insert, extract or build.' });
    expect(heap.validate({ i: '1,x', op: 'build', x: '1' })).toMatchObject({ ok: false, error: expect.stringContaining('whole numbers') });
    const full = Array.from({ length: 15 }, (_, k) => k).join(',');
    expect(heap.validate({ i: full, op: 'insert', x: '3' })).toEqual({ ok: false, error: 'A heap here holds at most 15 values: remove one before inserting.' });
    expect(heap.validate({ i: `${full},20`, op: 'build', x: '0' })).toMatchObject({ ok: false });
    expect(heap.encode({ a: [1, 2], op: 'extract', x: 0 })).toEqual({ i: '1,2', op: 'extract', x: '0' });
  });
});

/** Longest run (exact): build on 15 descending values, 47 sift steps (7 parents, each sinking to a leaf) + the end step. */
const MEASURED_MAX = 48;
