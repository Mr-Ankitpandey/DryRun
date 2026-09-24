import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import { askIndices } from '@/engine/run';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { QuickSortInput } from './index';
import { quickSort } from './index';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);

const arb: fc.Arbitrary<QuickSortInput> = fc.record({ a: fc.array(fc.integer({ min: 0, max: 99 }), { maxLength: 12 }) });

describe('quick sort module', () => {
  it('passes every preset', () => {
    for (const p of quickSort.presets) checkAll(quickSort, p.input);
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(quickSort, arb, 1000);
  });

  it('every call has a frame with numeric lo/hi, a matching return, and base cases are visible', () => {
    const r = runModule(quickSort, { a: [3, 1, 2] });
    const calls = r.steps.flatMap((s) => s.events.filter((e) => e.t === 'call'));
    const returns = r.steps.flatMap((s) => s.events.filter((e) => e.t === 'return'));
    expect(calls).toHaveLength(3); // [0,2] with pivot 2 → p = 1 → [0,0] and [2,2]
    expect(returns).toHaveLength(3);
    expect(calls[0]).toMatchObject({ t: 'call', id: 'f:0', args: { lo: 0, hi: 2 }, parent: null });
    expect(calls[1]).toMatchObject({ t: 'call', id: 'f:1', args: { lo: 0, hi: 0 }, parent: 'f:0' });
    expect(calls[2]).toMatchObject({ t: 'call', id: 'f:2', args: { lo: 2, hi: 2 }, parent: 'f:0' });
    expect(lastState(r).frameOrder).toEqual([]);
    expect(quickSort.result(lastState(r), { a: [3, 1, 2] })).toEqual([1, 2, 3]);
  });

  it('empty and single-element inputs produce one visible call and return', () => {
    for (const a of [[], [7]]) {
      const r = runModule(quickSort, { a });
      expect(r.steps.map((s) => s.line)).toEqual([1, 2]);
      expect(must(r.steps[1]).ask).toMatchObject({ kind: 'choice', answer: 'Return: lo ≥ hi' });
      if (a.length === 1) expect(lastState(r).elements['e:0']?.mark).toBe('done');
    }
  });

  it('partition on [6, 2, 8, 4]: pivot mark, compares, swaps (incl. self-swap), regions and final swap', () => {
    const r = runModule(quickSort, { a: [6, 2, 8, 4] });
    const part = r.steps.filter((s) => s.phase === 'partition');
    // pivot 4: j=0 6≥4 no; j=1 2<4 swap a[0],a[1]; j=2 8≥4 no; final swap a[1],a[3]
    expect(part.slice(0, 7).map((s) => s.line)).toEqual([7, 9, 9, 10, 9, 11, 12]);
    expect(must(part[0]).events[1]).toEqual({ t: 'mark', ref: { id: 'e:3' }, as: 'pivot' });
    const cmp0 = must(part[1]);
    expect(cmp0.events).toContainEqual({ t: 'compare', a: { arr: 'a', i: 0 }, b: { arr: 'a', i: 3 }, result: '>' });
    expect(cmp0.events).toContainEqual({ t: 'region', name: 'ge', kind: 'greaterEq', arr: 'a', range: [0, 0] });
    expect(cmp0.ask).toMatchObject({ kind: 'choice', answer: 'no', level: 'full' });
    expect(must(part[2]).ask).toMatchObject({ kind: 'choice', answer: 'yes' });
    const swap = must(part[3]);
    expect(swap.events).toContainEqual({ t: 'swap', a: { arr: 'a', i: 0 }, b: { arr: 'a', i: 1 } });
    expect(swap.events).toContainEqual({ t: 'region', name: 'less', kind: 'less', arr: 'a', range: [0, 0] });
    expect(swap.events).toContainEqual({ t: 'region', name: 'ge', kind: 'greaterEq', arr: 'a', range: [1, 1] });
    expect(swap.events).toContainEqual({ t: 'region', name: 'unscanned', kind: 'unscanned', arr: 'a', range: [2, 2] });
    const final = must(part[5]);
    expect(final.events[0]).toEqual({ t: 'swap', a: { arr: 'a', i: 1 }, b: { arr: 'a', i: 3 } });
    expect(final.events[1]).toEqual({ t: 'mark', ref: { id: 'e:3' }, as: 'done' });
    // the pick answer is the element currently at slot i+1 = 1, which is e:0 (6) after the earlier swap
    expect(final.ask).toMatchObject({ kind: 'pick', answer: 'e:0', candidates: ['e:1', 'e:0', 'e:2', 'e:3'] });
    if (final.ask?.kind === 'pick') expect(final.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([['e:1', 'boundary']]);
    const afterFinal = must(r.states[r.steps.indexOf(final) + 1]);
    expect(afterFinal.arrays.a?.slots).toEqual(['e:1', 'e:3', 'e:2', 'e:0']);
    expect(afterFinal.elements['e:3']?.mark).toBe('done');
    expect(afterFinal.regions.ge?.range).toEqual([2, 3]);
    const sorted = r.steps.find((s) => s.phase === 'partition' && s.note.includes('swaps with itself'));
    expect(sorted).toBeUndefined();
  });

  it('sorted input: every compare swaps with itself and the pivot lands at hi', () => {
    const r = runModule(quickSort, { a: [1, 2, 3] });
    const selfSwaps = r.steps.filter((s) => s.line === 10 && s.note.includes('swaps with itself'));
    expect(selfSwaps).toHaveLength(3);
    const land = r.steps.find((s) => s.line === 11);
    expect(land?.ask).toMatchObject({ kind: 'pick', answer: 'e:2' });
    expect(land?.note).toContain('swaps with itself');
  });

  it('segment asks: left first, then right, then done, in order', () => {
    const r = runModule(quickSort, { a: [5, 3, 8, 1] });
    const seg = r.steps.map((s) => s.ask).filter((a) => a?.kind === 'choice' && a.prompt.includes('Which segment'));
    // pivot 1 → p = 0: left [0, -1], right [1, 3], done; then inside [1,3]: pivot 8 → p = 3 …
    expect(seg[0]).toMatchObject({ answer: '[0, -1]', options: ['[0, -1]', '[1, 3]', 'done'], level: 'guided' });
    expect(seg[1]).toMatchObject({ answer: '[1, 3]' });
    if (seg[1]?.kind === 'choice') expect(seg[1].distractors.map((d) => [d.answer, d.kind])).toEqual([['[0, -1]', 'order'], ['done', 'base-case']]);
    expect(seg[seg.length - 1]).toMatchObject({ answer: 'done' });
    const lines = r.steps.filter((s) => s.ask?.kind === 'choice' && s.ask.prompt.includes('Which segment')).map((s) => s.line);
    expect(lines[0]).toBe(4);
    expect(lines[1]).toBe(5);
    expect(askIndices(r.steps, 'guided').length).toBeGreaterThanOrEqual(5);
  });

  it('final state: every element is marked done and in sorted order', () => {
    for (const p of quickSort.presets) {
      const final = lastState(runModule(quickSort, p.input));
      for (const id of must(final.arrays.a).slots) expect(final.elements[must(id)]?.mark).toBe('done');
      expect(final.pointers.lo).toBeNull();
      expect(final.regions.less?.range ?? null).toBeNull();
      expect(final.vars.phase ?? null).toBeNull();
    }
  });

  it('stays under the step cap on the largest inputs', () => {
    const cases: number[][] = [
      Array.from({ length: 12 }, (_, i) => i + 1),
      Array.from({ length: 12 }, (_, i) => 12 - i),
      Array.from({ length: 12 }, () => 5),
      [1, 3, 5, 7, 9, 11, 12, 10, 8, 6, 4, 2],
    ];
    for (let i = 0; i < 100; i++) cases.push(quickSort.randomInput(createRng(`cap-${i}`)).a);
    let max = 0;
    for (const a of cases) {
      const r = runModule(quickSort, { a });
      expect(r.truncated).toBe(false);
      expect(r.steps.length).toBeLessThanOrEqual(quickSort.meta.caps.maxSteps);
      max = Math.max(max, r.steps.length);
    }
    expect(max).toBe(222); // n = 12 sorted is the worst case
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'sorted', 'reverse', 'all-equal', 'duplicates', 'distinct']) {
      const a = quickSort.randomInput(createRng('seed-1'), target);
      const b = quickSort.randomInput(createRng('seed-1'), target);
      expect(a).toEqual(b);
      expect(quickSort.validate(quickSort.encode(a)).ok).toBe(true);
      expect(a.a.length).toBeGreaterThanOrEqual(5);
      const sorted = [...a.a].sort((p, q) => p - q);
      if (target === 'sorted') expect(a.a).toEqual(sorted);
      if (target === 'reverse') expect(a.a).toEqual(sorted.reverse());
      if (target === 'all-equal') expect(new Set(a.a).size).toBe(1);
      if (target === 'duplicates') expect(new Set(a.a).size).toBeLessThan(a.a.length);
      if (target === 'distinct') expect(new Set(a.a).size).toBe(a.a.length);
      checkAll(quickSort, a);
    }
  });

  it('rejects oversized and out-of-range input with actionable errors', () => {
    expect(quickSort.validate({ i: Array(13).fill(1).join(',') })).toMatchObject({ ok: false });
    expect(quickSort.validate({ i: '1,100' })).toMatchObject({ ok: false });
    expect(quickSort.validate({ i: '1,x' })).toMatchObject({ ok: false });
    expect(quickSort.validate({ i: '3,1,2' })).toEqual({ ok: true, input: { a: [3, 1, 2] } });
    expect(quickSort.encode({ a: [3, 1, 2] })).toEqual({ i: '3,1,2' });
  });
});
