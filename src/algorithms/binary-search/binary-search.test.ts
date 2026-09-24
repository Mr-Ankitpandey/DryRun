import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import { askIndices } from '@/engine/run';
import { createRng } from '@/lib/rng';
import type { BinarySearchInput } from './index';
import { binarySearch, reference } from './index';

const sortedArray = fc.array(fc.integer({ min: 0, max: 99 }), { maxLength: 16 }).map((a) => [...a].sort((p, q) => p - q));
const arb: fc.Arbitrary<BinarySearchInput> = fc.record({
  a: sortedArray,
  x: fc.integer({ min: 0, max: 99 }),
  variant: fc.constantFrom('classic', 'lower'),
});

describe('binary search module', () => {
  it('passes every preset', () => {
    for (const p of binarySearch.presets) checkAll(binarySearch, p.input);
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(binarySearch, arb, 1000);
  });

  it('classic result is a real index of x, or -1 when absent', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const idx = reference({ ...input, variant: 'classic' });
        if (idx === -1) expect(input.a.includes(input.x)).toBe(false);
        else expect(input.a[idx]).toBe(input.x);
      }),
    );
  });

  it('lower bound is the first index with a[i] >= x', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const idx = reference({ ...input, variant: 'lower' });
        const expected = input.a.findIndex((v) => v >= input.x);
        expect(idx).toBe(expected === -1 ? input.a.length : expected);
      }),
    );
  });

  it('basic preset: finds 42 at index 7 with guided asks at every mid and pointer move', () => {
    const r = runModule(binarySearch, { a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 42, variant: 'classic' });
    const final = r.states[r.states.length - 1];
    expect(final?.vars.result).toBe(7);
    const guided = askIndices(r.steps, 'guided');
    const full = askIndices(r.steps, 'full');
    expect(guided.length).toBeGreaterThanOrEqual(4);
    expect(full.length).toBeGreaterThan(guided.length);
    const first = r.steps[guided[0] as number]?.ask;
    expect(first?.kind).toBe('pick');
    if (first?.kind === 'pick') expect(first.answer).toBe('e:4');
  });

  it('stays under the step cap on the largest inputs', () => {
    const a = Array.from({ length: 16 }, (_, i) => i * 6);
    for (const x of [0, 5, 47, 90, 99]) {
      for (const variant of ['classic', 'lower'] as const) {
        const r = runModule(binarySearch, { a, x, variant });
        expect(r.truncated).toBe(false);
        expect(r.steps.length).toBeLessThanOrEqual(binarySearch.meta.caps.maxSteps);
      }
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'classic', 'lower', 'present', 'absent', 'duplicates']) {
      const a = binarySearch.randomInput(createRng('seed-1'), target);
      const b = binarySearch.randomInput(createRng('seed-1'), target);
      expect(a).toEqual(b);
      expect(binarySearch.validate(binarySearch.encode(a)).ok).toBe(true);
      if (target === 'present') expect(a.a).toContain(a.x);
      if (target === 'absent') expect(a.a).not.toContain(a.x);
      if (target === 'lower') expect(a.variant).toBe('lower');
      if (target === 'duplicates') expect(new Set(a.a).size).toBeLessThan(a.a.length);
    }
  });

  it('rejects unsorted, oversized and out-of-range input with actionable errors', () => {
    expect(binarySearch.validate({ i: '5,3', x: '3' })).toMatchObject({ ok: false });
    expect(binarySearch.validate({ i: Array(17).fill(1).join(','), x: '1' })).toMatchObject({ ok: false });
    expect(binarySearch.validate({ i: '1,2', x: '100' })).toMatchObject({ ok: false });
    expect(binarySearch.validate({ i: '1,x', x: '1' })).toMatchObject({ ok: false });
    expect(binarySearch.validate({ i: '', x: '1' })).toEqual({ ok: true, input: { a: [], x: 1, variant: 'classic' } });
  });
});
