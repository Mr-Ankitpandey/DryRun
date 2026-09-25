import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import { computeLayout } from '@/engine/layout';
import { askIndices } from '@/engine/run';
import { buildScene } from '@/engine/scene';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { MergeSortInput } from './index';
import { mergeSort } from './index';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);

const arb: fc.Arbitrary<MergeSortInput> = fc.record({ a: fc.array(fc.integer({ min: 0, max: 99 }), { maxLength: 16 }) });
const arbDup: fc.Arbitrary<MergeSortInput> = fc.record({ a: fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 16 }) });

describe('merge sort module', () => {
  it('passes every preset', () => {
    for (const p of mergeSort.presets) checkAll(mergeSort, p.input);
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(mergeSort, arb, 1000);
  });

  it('property: stable on 300 duplicate-heavy inputs (equal values keep input order)', () => {
    fc.assert(
      fc.property(arbDup, (input) => {
        const r = checkAll(mergeSort, input);
        const want = input.a
          .map((v, i) => ({ v, i }))
          .sort((p, q) => p.v - q.v || p.i - q.i)
          .map((x) => `e:${x.i}`);
        expect(must(lastState(r).arrays.a).slots).toEqual(want);
      }),
      { numRuns: 300 },
    );
  });

  it('[6, 2, 8, 4]: frames, aux declared once, copies move identities down, copy-back is one step', () => {
    const r = runModule(mergeSort, { a: [6, 2, 8, 4] });
    expect(r.steps.map((s) => s.line)).toEqual([1, 3, 4, 3, 4, 2, 4, 2, 7, 10, 8, 11, 12, 5, 4, 3, 4, 2, 4, 2, 7, 10, 8, 11, 12, 5, 7, 9, 10, 9, 8, 11, 12, 5]);
    const first = must(r.steps[0]);
    expect(first.events).toEqual([
      { t: 'array', name: 'aux', size: 4 },
      { t: 'call', id: 'f:0', label: 'mergesort(0, 3)', args: { lo: 0, hi: 3, mid: 1 }, parent: null },
    ]);
    expect(r.steps.flatMap((s) => s.events.filter((e) => e.t === 'array'))).toHaveLength(1);
    const calls = r.steps.flatMap((s) => s.events.filter((e) => e.t === 'call'));
    expect(calls).toHaveLength(7);
    expect(calls[2]).toMatchObject({ id: 'f:2', args: { lo: 0, hi: 0 }, parent: 'f:1' });
    expect(r.steps.flatMap((s) => s.events.filter((e) => e.t === 'return'))).toHaveLength(7);

    const copy = must(r.steps[9]);
    expect(copy.events.slice(0, 2)).toEqual([
      { t: 'compare', a: { id: 'e:0' }, b: { id: 'e:1' }, result: '>' },
      { t: 'move', id: 'e:1', to: { arr: 'aux', i: 0 } },
    ]);
    expect(copy.ask).toMatchObject({ kind: 'pick', level: 'guided', answer: 'e:1', candidates: ['e:0', 'e:1'] });
    if (copy.ask?.kind === 'pick') expect(copy.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([['e:0', 'comparison']]);
    expect(must(r.steps[10]).ask).toMatchObject({ kind: 'value', level: 'full', answer: 1 });

    const back = must(r.steps[12]);
    expect(back.events.filter((e) => e.t === 'move')).toEqual([
      { t: 'move', id: 'e:1', to: { arr: 'a', i: 0 } },
      { t: 'move', id: 'e:0', to: { arr: 'a', i: 1 } },
    ]);
    expect(back.events).toContainEqual({ t: 'region', name: 'sorted:0', kind: 'sorted', arr: 'a', range: [0, 1] });
    const after = must(r.states[13]);
    expect(after.arrays.aux?.slots).toEqual([null, null, null, null]);
    expect(after.pointers.k).toBeNull();

    const ret = must(r.steps[13]);
    expect(ret.ask).toMatchObject({ kind: 'choice', level: 'full', answer: 'mergesort(0, 1)', options: ['mergesort(0, 3)', 'mergesort(0, 1)'] });
    if (ret.ask?.kind === 'choice') expect(ret.ask.distractors).toEqual([{ answer: 'mergesort(0, 3)', kind: 'order', rule: expect.any(String) }]);
    expect(must(r.steps[33]).ask).toBeUndefined(); // the root return: only one open call

    // final merge clears the right child's region and grows sorted:0 to the whole array
    const finalBack = must(r.steps[32]);
    expect(finalBack.events).toContainEqual({ t: 'region', name: 'sorted:0', kind: 'sorted', arr: 'a', range: [0, 3] });
    expect(finalBack.events).toContainEqual({ t: 'region', name: 'sorted:2', kind: 'sorted', arr: 'a', range: null });
    const final = lastState(r);
    expect(final.arrays.a?.slots).toEqual(['e:1', 'e:3', 'e:0', 'e:2']);
    expect(final.frameOrder).toEqual([]);
  });

  it('ties copy the left element, and the right one is an order distractor', () => {
    const r = runModule(mergeSort, { a: [5, 5] });
    const copy = must(r.steps.find((s) => s.ask?.kind === 'pick'));
    expect(copy.line).toBe(9);
    expect(copy.events[0]).toEqual({ t: 'compare', a: { id: 'e:0' }, b: { id: 'e:1' }, result: '=' });
    expect(copy.ask).toMatchObject({ answer: 'e:0' });
    if (copy.ask?.kind === 'pick') expect(copy.ask.distractors).toEqual([{ answer: 'e:1', kind: 'order', rule: expect.stringContaining('Left first on ties') }]);
  });

  it('odd length: mid rounds down so the left half is the shorter-or-equal one', () => {
    const r = runModule(mergeSort, { a: [5, 1, 6, 2, 7, 3, 4] });
    const calls = r.steps.flatMap((s) => s.events.filter((e) => e.t === 'call'));
    expect(calls[0]).toMatchObject({ args: { lo: 0, hi: 6, mid: 3 } });
    expect(calls[1]).toMatchObject({ args: { lo: 0, hi: 3, mid: 1 } });
    expect(calls.filter((c) => c.t === 'call' && c.args.lo === 4 && c.args.hi === 6)).toHaveLength(1);
  });

  it('every leftover is its own copy step, and every element passes through aux once per level', () => {
    const r = runModule(mergeSort, { a: [1, 2, 3, 4, 5, 6, 7, 8] });
    const toAux = r.steps.flatMap((s) => s.events.filter((e) => e.t === 'move' && e.to.arr === 'aux'));
    expect(toAux).toHaveLength(24); // 3 levels × 8
    for (const s of r.steps.filter((x) => x.line === 11)) expect(s.events.filter((e) => e.t === 'move')).toHaveLength(1);
  });

  it('empty and single inputs: one call and one return, no aux', () => {
    for (const a of [[], [7]]) {
      const r = runModule(mergeSort, { a });
      expect(r.steps.map((s) => s.line)).toEqual([1, 2]);
      expect(lastState(r).arrays.aux).toBeUndefined();
    }
  });

  it('every step and ask obeys the narration and ask rules on presets and random inputs', () => {
    const inputs = [...mergeSort.presets.map((p) => p.input)];
    for (let i = 0; i < 50; i++) inputs.push(mergeSort.randomInput(createRng(`n-${i}`)));
    inputs.push({ a: [99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84] });
    for (const input of inputs) {
      const r = runModule(mergeSort, input);
      for (const s of r.steps) {
        expect(s.note.length).toBeLessThanOrEqual(90);
        expect(s.note).not.toMatch(/\bwe\b/i);
        if (s.ask) {
          expect(s.ask.rule.length).toBeGreaterThan(0);
          for (const d of s.ask.distractors) expect(d.rule.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('guided asks exist on a typical preset', () => {
    const r = runModule(mergeSort, must(mergeSort.presets[0]).input);
    expect(askIndices(r.steps, 'guided').length).toBeGreaterThanOrEqual(10);
  });

  it('stays under the step cap: n = 16 is the worst case (186 steps, independent of values)', () => {
    const cases: number[][] = [Array.from({ length: 16 }, (_, i) => 16 - i), Array.from({ length: 16 }, () => 5), Array.from({ length: 15 }, (_, i) => i)];
    for (let i = 0; i < 200; i++) cases.push(mergeSort.randomInput(createRng(`cap-${i}`)).a);
    let max = 0;
    for (const a of cases) {
      const r = runModule(mergeSort, { a });
      expect(r.truncated).toBe(false);
      expect(r.steps.length).toBeLessThanOrEqual(mergeSort.meta.caps.maxSteps);
      max = Math.max(max, r.steps.length);
    }
    expect(max).toBe(186);
  });

  it('the scene builds for every state of every preset', () => {
    for (const p of mergeSort.presets) {
      const r = runModule(mergeSort, p.input);
      const layout = computeLayout(r);
      for (const s of r.states) buildScene(s, layout, { width: layout.width });
      if (p.input.a.length >= 2) expect(layout.array?.order).toEqual(['a', 'aux']);
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'sorted', 'reverse', 'all-equal', 'duplicates', 'distinct', 'odd-length']) {
      const a = mergeSort.randomInput(createRng('seed-1'), target);
      const b = mergeSort.randomInput(createRng('seed-1'), target);
      expect(a).toEqual(b);
      expect(mergeSort.validate(mergeSort.encode(a)).ok).toBe(true);
      expect(a.a.length).toBeGreaterThanOrEqual(5);
      const sorted = [...a.a].sort((p, q) => p - q);
      if (target === 'sorted') expect(a.a).toEqual(sorted);
      if (target === 'reverse') expect(a.a).toEqual(sorted.reverse());
      if (target === 'all-equal') expect(new Set(a.a).size).toBe(1);
      if (target === 'duplicates') expect(new Set(a.a).size).toBeLessThan(a.a.length);
      if (target === 'distinct') expect(new Set(a.a).size).toBe(a.a.length);
      if (target === 'odd-length') expect(a.a.length % 2).toBe(1);
      checkAll(mergeSort, a);
    }
  });

  it('rejects oversized and out-of-range input with actionable sentences', () => {
    expect(mergeSort.validate({ i: Array(17).fill(1).join(',') })).toEqual({ ok: false, error: 'Use at most 16 numbers (got 17).' });
    expect(mergeSort.validate({ i: '1,100' })).toEqual({ ok: false, error: '100 is out of range: use values from 0 to 99.' });
    expect(mergeSort.validate({ i: '1,2.5' })).toEqual({ ok: false, error: '"2.5" is not a whole number: separate whole numbers with commas.' });
    expect(mergeSort.validate({ i: Array(16).fill(1).join(',') })).toMatchObject({ ok: true });
    expect(mergeSort.encode({ a: [3, 1, 2] })).toEqual({ i: '3,1,2' });
    expect(mergeSort.decode({ i: '3,1,2' })).toEqual({ a: [3, 1, 2] });
  });
});
