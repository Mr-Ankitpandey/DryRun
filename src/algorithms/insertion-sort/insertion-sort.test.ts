import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import { computeLayout } from '@/engine/layout';
import { askIndices } from '@/engine/run';
import { buildScene } from '@/engine/scene';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { InsertionSortInput } from './index';
import { insertionSort } from './index';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);

const arb: fc.Arbitrary<InsertionSortInput> = fc.record({ a: fc.array(fc.integer({ min: 0, max: 99 }), { maxLength: 12 }) });
/** Small value range so duplicates (stability) are common. */
const arbDup: fc.Arbitrary<InsertionSortInput> = fc.record({ a: fc.array(fc.integer({ min: 0, max: 4 }), { maxLength: 12 }) });

describe('insertion sort module', () => {
  it('passes every preset', () => {
    for (const p of insertionSort.presets) checkAll(insertionSort, p.input);
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(insertionSort, arb, 1000);
  });

  it('property: stable on 300 duplicate-heavy inputs (equal values keep input order)', () => {
    fc.assert(
      fc.property(arbDup, (input) => {
        const r = checkAll(insertionSort, input);
        const got = must(lastState(r).arrays.a).slots;
        const want = input.a
          .map((v, i) => ({ v, i }))
          .sort((p, q) => p.v - q.v || p.i - q.i)
          .map((x) => `e:${x.i}`);
        expect(got).toEqual(want);
      }),
      { numRuns: 300 },
    );
  });

  it('[5, 2, 4]: lift into hold, compare, shift as a move into the gap, land at j + 1', () => {
    const r = runModule(insertionSort, { a: [5, 2, 4] });
    expect(r.steps.map((s) => s.line)).toEqual([1, 2, 3, 4, 6, 2, 3, 4, 3, 6]);
    const setup = must(r.steps[0]);
    expect(setup.events).toEqual([
      { t: 'array', name: 'hold', size: 1 },
      { t: 'region', name: 'sorted', kind: 'sorted', arr: 'a', range: [0, 0] },
    ]);
    const lift = must(r.steps[1]);
    expect(lift.events).toContainEqual({ t: 'move', id: 'e:1', to: { arr: 'hold', i: 0 } });
    expect(lift.events).toContainEqual({ t: 'mark', ref: { id: 'e:1' }, as: 'key' });
    expect(must(r.states[2]).arrays.a?.slots).toEqual(['e:0', null, 'e:2']);
    const cmp = must(r.steps[2]);
    expect(cmp.events).toEqual([{ t: 'compare', a: { arr: 'a', i: 0 }, b: { arr: 'hold', i: 0 }, result: '>' }]);
    expect(cmp.ask).toMatchObject({ kind: 'choice', level: 'full', answer: 'yes', options: ['yes', 'no'] });
    const shift = must(r.steps[3]);
    expect(shift.events[0]).toEqual({ t: 'move', id: 'e:0', to: { arr: 'a', i: 1 } });
    expect(shift.events).toContainEqual({ t: 'pointer', name: 'j', at: { arr: 'a', i: -1 } });
    expect(shift.ask).toMatchObject({ kind: 'pick', level: 'guided', answer: 'e:0', candidates: ['e:0', 'e:2', 'e:1'] });
    if (shift.ask?.kind === 'pick') expect(shift.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([['e:1', 'shift-vs-swap']]);
    const land = must(r.steps[4]);
    expect(land.events[0]).toEqual({ t: 'move', id: 'e:1', to: { arr: 'a', i: 0 } });
    expect(land.events).toContainEqual({ t: 'region', name: 'sorted', kind: 'sorted', arr: 'a', range: [0, 1] });
    expect(land.ask).toMatchObject({ kind: 'choice', level: 'guided', answer: 'slot 0', options: ['slot 0', 'slot 1'] });
    expect(land.note).toContain('j = −1');
    // second pass: two candidates left of the gap → the boundary distractor appears
    const shift2 = must(r.steps[7]);
    expect(shift2.ask).toMatchObject({ kind: 'pick', answer: 'e:0', candidates: ['e:1', 'e:0', 'e:2'] });
    if (shift2.ask?.kind === 'pick') {
      expect(shift2.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([
        ['e:2', 'shift-vs-swap'],
        ['e:1', 'boundary'],
      ]);
    }
    const stop = must(r.steps[8]);
    expect(stop.ask).toMatchObject({ kind: 'choice', answer: 'no' });
    const land2 = must(r.steps[9]);
    expect(land2.ask).toMatchObject({ kind: 'choice', answer: 'slot 1', options: ['slot 0', 'slot 1', 'slot 2'] });
    if (land2.ask?.kind === 'choice') expect(land2.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([['slot 0', 'boundary']]);
    const final = lastState(r);
    expect(final.arrays.a?.slots).toEqual(['e:1', 'e:2', 'e:0']);
    expect(final.arrays.hold?.slots).toEqual([null]);
    expect(final.elements['e:2']?.mark).toBeNull();
    expect(final.pointers.i).toBeNull();
    expect(final.regions.sorted?.range).toEqual([0, 2]);
  });

  it('an equal a[j] stops the key: the landing distractor for slot j is a comparison mistake', () => {
    const r = runModule(insertionSort, { a: [3, 3] });
    expect(r.steps.map((s) => s.line)).toEqual([1, 2, 3, 6]);
    expect(must(r.steps[2]).events[0]).toMatchObject({ t: 'compare', result: '=' });
    expect(must(r.steps[2]).ask).toMatchObject({ answer: 'no' });
    const land = must(r.steps[3]).ask;
    expect(land).toMatchObject({ kind: 'choice', answer: 'slot 1' });
    if (land?.kind === 'choice') expect(land.distractors.map((d) => [d.answer, d.kind])).toEqual([['slot 0', 'comparison']]);
    expect(lastState(r).arrays.a?.slots).toEqual(['e:0', 'e:1']);
  });

  it('sorted input has no shifts; reverse input shifts i times in pass i', () => {
    const sorted = runModule(insertionSort, must(insertionSort.presets.find((p) => p.id === 'sorted')).input);
    expect(sorted.steps.filter((s) => s.line === 4)).toHaveLength(0);
    const rev = runModule(insertionSort, { a: [6, 5, 4, 3, 2, 1] });
    expect(rev.steps.filter((s) => s.line === 4)).toHaveLength(15);
    expect(rev.steps.filter((s) => s.line === 3)).toHaveLength(15); // j always runs out: no stopping compare
  });

  it('empty and single inputs: one setup step, no hold array', () => {
    for (const a of [[], [7]]) {
      const r = runModule(insertionSort, { a });
      expect(r.steps).toHaveLength(1);
      expect(lastState(r).arrays.hold).toBeUndefined();
      expect(lastState(r).regions.sorted?.range ?? null).toEqual(a.length ? [0, 0] : null);
    }
  });

  it('every step and ask obeys the narration and ask rules on presets and random inputs', () => {
    const inputs = [...insertionSort.presets.map((p) => p.input)];
    for (let i = 0; i < 50; i++) inputs.push(insertionSort.randomInput(createRng(`n-${i}`)));
    inputs.push({ a: [99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88] });
    for (const input of inputs) {
      const r = runModule(insertionSort, input);
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
    const r = runModule(insertionSort, must(insertionSort.presets[0]).input);
    expect(askIndices(r.steps, 'guided').length).toBeGreaterThanOrEqual(5);
  });

  it('stays under the step cap: worst case is n = 12 reverse (155 steps)', () => {
    const cases: number[][] = [
      Array.from({ length: 12 }, (_, i) => 12 - i),
      Array.from({ length: 12 }, (_, i) => i),
      Array.from({ length: 12 }, () => 5),
    ];
    for (let i = 0; i < 200; i++) cases.push(insertionSort.randomInput(createRng(`cap-${i}`)).a);
    let max = 0;
    for (const a of cases) {
      const r = runModule(insertionSort, { a });
      expect(r.truncated).toBe(false);
      expect(r.steps.length).toBeLessThanOrEqual(insertionSort.meta.caps.maxSteps);
      max = Math.max(max, r.steps.length);
    }
    expect(max).toBe(155);
  });

  it('the scene builds for every state of every preset', () => {
    for (const p of insertionSort.presets) {
      const r = runModule(insertionSort, p.input);
      const layout = computeLayout(r);
      for (const s of r.states) buildScene(s, layout, { width: layout.width });
      if (p.input.a.length >= 2) expect(layout.array?.order).toEqual(['hold', 'a']);
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'sorted', 'reverse', 'all-equal', 'duplicates', 'distinct']) {
      const a = insertionSort.randomInput(createRng('seed-1'), target);
      const b = insertionSort.randomInput(createRng('seed-1'), target);
      expect(a).toEqual(b);
      expect(insertionSort.validate(insertionSort.encode(a)).ok).toBe(true);
      expect(a.a.length).toBeGreaterThanOrEqual(5);
      const sorted = [...a.a].sort((p, q) => p - q);
      if (target === 'sorted') expect(a.a).toEqual(sorted);
      if (target === 'reverse') expect(a.a).toEqual(sorted.reverse());
      if (target === 'all-equal') expect(new Set(a.a).size).toBe(1);
      if (target === 'duplicates') expect(new Set(a.a).size).toBeLessThan(a.a.length);
      if (target === 'distinct') expect(new Set(a.a).size).toBe(a.a.length);
      checkAll(insertionSort, a);
    }
  });

  it('rejects oversized and out-of-range input with actionable sentences', () => {
    expect(insertionSort.validate({ i: Array(13).fill(1).join(',') })).toEqual({ ok: false, error: 'Use at most 12 numbers (got 13).' });
    expect(insertionSort.validate({ i: '1,100' })).toEqual({ ok: false, error: '100 is out of range: use values from 0 to 99.' });
    expect(insertionSort.validate({ i: '1,-3' })).toMatchObject({ ok: false, error: expect.stringContaining('out of range') });
    expect(insertionSort.validate({ i: '1,x' })).toEqual({ ok: false, error: '"x" is not a whole number: separate whole numbers with commas.' });
    expect(insertionSort.validate({ i: '' })).toEqual({ ok: true, input: { a: [] } });
    expect(insertionSort.validate({ i: ' 3, 1 ,2 ' })).toEqual({ ok: true, input: { a: [3, 1, 2] } });
    expect(insertionSort.encode({ a: [3, 1, 2] })).toEqual({ i: '3,1,2' });
    expect(insertionSort.decode({ i: '3,1,2' })).toEqual({ a: [3, 1, 2] });
    expect(insertionSort.decode({ i: '3,1,200' })).toBeNull();
  });
});
