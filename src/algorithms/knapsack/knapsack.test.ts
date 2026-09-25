import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import type { Step } from '@/engine/events';
import { computeLayout } from '@/engine/layout';
import { askIndices } from '@/engine/run';
import { buildScene } from '@/engine/scene';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { KnapsackInput } from './index';
import { knapsack, reference } from './index';
import { hasTie } from './input';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);

const arb: fc.Arbitrary<KnapsackInput> = fc.integer({ min: 1, max: 5 }).chain((n) =>
  fc.record({
    w: fc.array(fc.integer({ min: 1, max: 6 }), { minLength: n, maxLength: n }),
    v: fc.array(fc.integer({ min: 1, max: 20 }), { minLength: n, maxLength: n }),
    W: fc.integer({ min: 0, max: 10 }),
  }),
);

const preset = (id: string): KnapsackInput => must(knapsack.presets.find((p) => p.id === id)).input;
const writeOf = (steps: Step[], i: number, c: number): Step => must(steps.find((s) => s.events.some((e) => e.t === 'cell' && e.r === i && e.c === c)));

/** Brute force over every subset: the best value any subset within W reaches. */
function bruteBest(input: KnapsackInput): number {
  let best = 0;
  const n = input.w.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    let w = 0;
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      w += input.w[i] as number;
      v += input.v[i] as number;
    }
    if (w <= input.W) best = Math.max(best, v);
  }
  return best;
}

describe('knapsack module', () => {
  it('passes every preset', () => {
    for (const p of knapsack.presets) checkAll(knapsack, p.input);
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(knapsack, arb, 1000);
  });

  it('reference: best equals brute force and the taken items fit and add up to it', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = reference(input);
        expect(r.best).toBe(bruteBest(input));
        expect(r.taken.reduce((s, i) => s + (input.w[i - 1] as number), 0)).toBeLessThanOrEqual(input.W);
        expect(r.taken.reduce((s, i) => s + (input.v[i - 1] as number), 0)).toBe(r.best);
      }),
      { numRuns: 500 },
    );
  });

  it('classic: row 0, one write per cell with deps, probe on the last column, walk back', () => {
    const r = runModule(knapsack, preset('classic'));
    expect(r.steps).toHaveLength(42); // 1 + 4 × 8 cells + 4 probes + 4 walk + 1 final
    const row0 = must(r.steps[0]);
    expect(row0.events[0]).toEqual({ t: 'grid', rows: 5, cols: 8, rowLabels: ['0', 'item 1 (1, 1)', 'item 2 (3, 4)', 'item 3 (4, 5)', 'item 4 (5, 7)'], colLabels: ['0', '1', '2', '3', '4', '5', '6', '7'] });
    expect(row0.events.filter((e) => e.t === 'cell')).toHaveLength(8);
    expect(row0.events[1]).toEqual({ t: 'cell', r: 0, c: 0, value: 0, deps: [] });

    const noFit = writeOf(r.steps, 2, 1);
    expect(noFit.line).toBe(4);
    expect(noFit.events).toContainEqual({ t: 'cell', r: 2, c: 1, value: 1, deps: [[1, 1]] });
    expect(noFit.ask).toMatchObject({ kind: 'value', level: 'guided', answer: 1 });

    const takeWins = writeOf(r.steps, 2, 7);
    expect(takeWins.line).toBe(6);
    expect(takeWins.events).toEqual([
      { t: 'mark', ref: { cell: [2, 6] }, as: null },
      { t: 'cell', r: 2, c: 7, value: 5, deps: [[1, 7], [1, 4]] },
      { t: 'mark', ref: { cell: [2, 7] }, as: 'active' },
    ]);
    if (takeWins.ask?.kind === 'value') {
      expect(takeWins.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([
        [9, 'dependency'],
        [1, 'comparison'],
      ]);
    }
    const skipWins = writeOf(r.steps, 4, 7);
    expect(skipWins.ask).toMatchObject({ answer: 9 });
    if (skipWins.ask?.kind === 'value') expect(skipWins.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([[8, 'comparison']]);

    const k = r.steps.indexOf(takeWins);
    const probe = must(r.steps[k - 1]);
    expect(probe.line).toBe(5);
    expect(probe.events).toEqual([
      { t: 'read', ref: { cell: [1, 7] } },
      { t: 'read', ref: { cell: [1, 4] } },
    ]);
    expect(probe.ask).toMatchObject({ kind: 'pick', level: 'full', answer: 'c:1,4' });
    if (probe.ask?.kind === 'pick') {
      expect(probe.ask.candidates).toHaveLength(8 + 7);
      expect(probe.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([
        ['c:2,4', 'dependency'],
        ['c:1,6', 'dependency'],
      ]);
    }

    const walk = r.steps.filter((s) => s.phase === 'reconstruct');
    expect(walk.map((s) => s.ask?.kind === 'choice' && s.ask.answer)).toEqual(['no', 'yes', 'yes', 'no', false]);
    expect(must(walk[1]).events).toContainEqual({ t: 'mark', ref: { cell: [3, 7] }, as: 'done' });
    expect(must(walk[0]).events).toContainEqual({ t: 'mark', ref: { cell: [4, 7] }, as: 'visited' });
    expect(must(walk[0]).events[0]).toEqual({ t: 'mark', ref: { cell: [4, 7] }, as: null }); // clears the active cell
    expect(must(walk[4]).note).toBe('Items 2, 3: value 9, weight 7 of 7.');
    expect(knapsack.result(lastState(r), preset('classic'))).toEqual({ best: 9, taken: [2, 3] });
  });

  it('tie preset: equal take and skip reads as skip, so items 1 and 2 are taken', () => {
    const input = preset('tie');
    expect(hasTie(input)).toBe(true);
    const r = runModule(knapsack, input);
    const tieCell = writeOf(r.steps, 3, 3);
    expect(tieCell.note).toBe('Take and skip tie at 3, so dp[3][3] = 3.');
    const first = must(r.steps.find((s) => s.phase === 'reconstruct'));
    expect(first.ask).toMatchObject({ kind: 'choice', answer: 'no' });
    if (first.ask?.kind === 'choice') expect(first.ask.distractors[0]).toMatchObject({ answer: 'yes', kind: 'dependency' });
    expect(knapsack.result(lastState(r), input)).toEqual({ best: 3, taken: [1, 2] });
  });

  it('zero capacity and a too-heavy item: no probes, rows copy the cell above', () => {
    for (const id of ['zero-capacity', 'item-too-heavy']) {
      const r = runModule(knapsack, preset(id));
      const heavyRow = r.steps.filter((s) => s.events.some((e) => e.t === 'cell' && e.r === 1));
      for (const s of heavyRow) expect(s.line).toBe(4);
      if (id === 'zero-capacity') expect(r.steps.some((s) => s.line === 5)).toBe(false);
    }
    expect(knapsack.result(lastState(runModule(knapsack, preset('item-too-heavy'))), preset('item-too-heavy'))).toEqual({ best: 3, taken: [2] });
  });

  it('every step and ask obeys the narration and ask rules on presets and random inputs', () => {
    const inputs = [...knapsack.presets.map((p) => p.input)];
    for (let i = 0; i < 50; i++) inputs.push(knapsack.randomInput(createRng(`n-${i}`)));
    inputs.push({ w: [6, 6, 6, 6, 6], v: [20, 20, 20, 20, 20], W: 10 });
    for (const input of inputs) {
      const r = runModule(knapsack, input);
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

  it('value asks: the answer is what the step writes; the current-row distractor appears only when it differs', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = runModule(knapsack, input);
        r.steps.forEach((s) => {
          if (s.ask?.kind !== 'value') return;
          const cell = must(s.events.find((e) => e.t === 'cell'));
          if (cell.t === 'cell') expect(s.ask.answer).toBe(cell.value);
          const answers = s.ask.distractors.map((d) => d.answer);
          expect(new Set(answers).size).toBe(answers.length);
        });
      }),
      { numRuns: 300 },
    );
  });

  it('guided asks exist on a typical preset', () => {
    expect(askIndices(runModule(knapsack, preset('classic')).steps, 'guided').length).toBe(32);
  });

  it('stays under the step cap: 5 items, W = 10, every item fitting is the worst case (67 steps)', () => {
    const cases: KnapsackInput[] = [{ w: [1, 1, 1, 1, 1], v: [1, 2, 3, 4, 5], W: 10 }, { w: [6, 6, 6, 6, 6], v: [1, 1, 1, 1, 1], W: 10 }];
    for (let i = 0; i < 200; i++) cases.push(knapsack.randomInput(createRng(`cap-${i}`)));
    let max = 0;
    for (const input of cases) {
      const r = runModule(knapsack, input);
      expect(r.truncated).toBe(false);
      max = Math.max(max, r.steps.length);
    }
    expect(max).toBe(67); // 1 + 5 × 11 + 5 probes + 5 walk + 1 final
    expect(knapsack.meta.caps.maxSteps).toBeGreaterThanOrEqual(Math.ceil(max * 1.1));
  });

  it('the scene builds for every state of every preset', () => {
    for (const p of knapsack.presets) {
      const r = runModule(knapsack, p.input);
      const layout = computeLayout(r);
      for (const s of r.states) buildScene(s, layout, { width: layout.width });
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'tie', 'all-fit', 'partial']) {
      const a = knapsack.randomInput(createRng('seed-1'), target);
      const b = knapsack.randomInput(createRng('seed-1'), target);
      expect(a).toEqual(b);
      expect(knapsack.validate(knapsack.encode(a)).ok).toBe(true);
      const total = a.w.reduce((s, x) => s + x, 0);
      if (target === 'tie') expect(hasTie(a)).toBe(true);
      if (target === 'all-fit') expect(total).toBeLessThanOrEqual(a.W);
      if (target === 'partial') expect(total).toBeGreaterThan(a.W);
      checkAll(knapsack, a);
    }
  });

  it('rejects bad input with actionable sentences', () => {
    const ok = { w: '2,3', v: '3,4', W: '5' };
    expect(knapsack.validate(ok)).toEqual({ ok: true, input: { w: [2, 3], v: [3, 4], W: 5 } });
    expect(knapsack.validate({ ...ok, w: '2,7' })).toEqual({ ok: false, error: 'A weight of 7 is out of range: use weights from 1 to 6.' });
    expect(knapsack.validate({ ...ok, w: '0,3' })).toMatchObject({ ok: false, error: expect.stringContaining('weights from 1 to 6') });
    expect(knapsack.validate({ ...ok, v: '3,21' })).toEqual({ ok: false, error: 'A value of 21 is out of range: use values from 1 to 20.' });
    expect(knapsack.validate({ ...ok, v: '3' })).toEqual({ ok: false, error: 'Give one value per weight: 2 weights but 1 value.' });
    expect(knapsack.validate({ ...ok, w: '1,1,1,1,1,1', v: '1,1,1,1,1,1' })).toEqual({ ok: false, error: 'Use at most 5 items (got 6).' });
    expect(knapsack.validate({ ...ok, W: '11' })).toEqual({ ok: false, error: 'The capacity W must be at most 10 (got 11).' });
    expect(knapsack.validate({ ...ok, W: '-1' })).toMatchObject({ ok: false, error: expect.stringContaining('capacity W') });
    expect(knapsack.validate({ ...ok, w: '' })).toMatchObject({ ok: false, error: expect.stringContaining('w=') });
    expect(knapsack.validate({ ...ok, w: '2,x' })).toMatchObject({ ok: false, error: expect.stringContaining('"x" is not a whole number') });
    expect(knapsack.encode({ w: [2, 3, 4], v: [3, 4, 5], W: 7 })).toEqual({ w: '2,3,4', v: '3,4,5', W: '7' });
  });
});
