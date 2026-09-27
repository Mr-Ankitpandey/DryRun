import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import type { Step } from '@/engine/events';
import { computeLayout } from '@/engine/layout';
import { askIndices } from '@/engine/run';
import { buildScene } from '@/engine/scene';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { LcsInput } from './index';
import { lcs, reference } from './index';
import { walk } from './generator';
import { walkHasTie } from './input';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);

const word = (alphabet: string) => fc.array(fc.constantFrom(...alphabet.split('')), { maxLength: 7 }).map((xs) => xs.join(''));
const arb: fc.Arbitrary<LcsInput> = fc.constantFrom('AB', 'ABC', 'ABCD', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').chain((alpha) => fc.record({ a: word(alpha), b: word(alpha) }));

const preset = (id: string): LcsInput => must(lcs.presets.find((p) => p.id === id)).input;
const writeOf = (steps: Step[], i: number, j: number): Step => must(steps.find((s) => s.events.some((e) => e.t === 'cell' && e.r === i && e.c === j)));

/** Brute force: longest subsequence of a that is also a subsequence of b. */
function isSubsequence(s: string, t: string): boolean {
  let k = 0;
  for (const ch of t) if (k < s.length && s[k] === ch) k++;
  return k === s.length;
}
function bruteLength(a: string, b: string): number {
  let best = 0;
  for (let mask = 0; mask < 1 << a.length; mask++) {
    let s = '';
    for (let i = 0; i < a.length; i++) if (mask & (1 << i)) s += a[i];
    if (s.length > best && isSubsequence(s, b)) best = s.length;
  }
  return best;
}

/** Exact step count: border + one write per cell + match probes (first column,
 *  when there are 2+ columns) + read probes (last column) + walk + final. */
const expectedSteps = (x: LcsInput): number => {
  const m = x.a.length;
  const n = x.b.length;
  return 1 + m * n + (n >= 2 ? m : 0) + (n >= 1 ? m : 0) + walk(x).cells.length + 1;
};

describe('lcs module', () => {
  it('passes every preset', () => {
    for (const p of lcs.presets) checkAll(lcs, p.input);
  });

  it('the empty grid is on stage at step 0, before any step runs', () => {
    const s0 = must(runModule(lcs, preset('classic')).states[0]);
    expect(s0.grid).toEqual({ rows: 8, cols: 7, rowLabels: ['', 'A', 'B', 'C', 'B', 'D', 'A', 'B'], colLabels: ['', 'B', 'D', 'C', 'A', 'B', 'A'], cells: {} });
    for (const p of lcs.presets) {
      const r = runModule(lcs, p.input);
      expect(must(r.states[0]).grid).toMatchObject({ rows: p.input.a.length + 1, cols: p.input.b.length + 1 });
      expect(r.steps.some((s) => s.events.some((e) => e.t === 'grid'))).toBe(false); // one source: the initial state
    }
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(lcs, arb, 1000);
  });

  it('reference: length equals brute force; the walk yields a common subsequence of that length', () => {
    fc.assert(
      fc.property(arb, (x) => {
        const r = reference(x);
        expect(r.length).toBe(bruteLength(x.a, x.b));
        expect(r.lcs.length).toBe(r.length);
        expect(isSubsequence(r.lcs, x.a) && isSubsequence(r.lcs, x.b)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('classic: border, writes with deps, probes, walk back to BCBA', () => {
    const input = preset('classic');
    const r = runModule(lcs, input);
    expect(r.steps).toHaveLength(66); // 1 + 42 cells + 7 match probes + 7 read probes + 8 walk + 1 final
    expect(r.steps.length).toBe(expectedSteps(input));
    const border = must(r.steps[0]);
    expect(border.events).toHaveLength(8 + 6);
    expect(border.events.every((e) => e.t === 'cell' && e.value === 0 && e.deps.length === 0 && (e.r === 0 || e.c === 0))).toBe(true);

    // match probe on the first column
    const probe = must(r.steps[1]);
    expect(probe.line).toBe(4);
    expect(probe.events).toEqual([
      { t: 'var', name: 'a[i-1]', value: 'A' },
      { t: 'var', name: 'b[j-1]', value: 'B' },
      { t: 'compare', a: { var: 'a[i-1]' }, b: { var: 'b[j-1]' } },
    ]);
    expect(probe.ask).toMatchObject({ kind: 'choice', level: 'guided', answer: 'no', options: ['yes', 'no'] });

    // a match: dp[1][4] = dp[0][3] + 1, reads only the diagonal
    const m14 = writeOf(r.steps, 1, 4);
    expect(m14.line).toBe(4);
    expect(m14.events).toEqual([
      { t: 'mark', ref: { cell: [1, 3] }, as: null },
      { t: 'var', name: 'a[i-1]', value: 'A' },
      { t: 'var', name: 'b[j-1]', value: 'A' },
      { t: 'compare', a: { var: 'a[i-1]' }, b: { var: 'b[j-1]' }, result: '=' },
      { t: 'cell', r: 1, c: 4, value: 1, deps: [[0, 3]] },
      { t: 'mark', ref: { cell: [1, 4] }, as: 'active' },
    ]);
    expect(m14.ask).toMatchObject({ kind: 'value', level: 'guided', answer: 1 });
    if (m14.ask?.kind === 'value') expect(m14.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([[0, 'comparison']]);

    // a mismatch: dp[3][2] = max(1, 1) = 1; diagonal + 1 = 2 is the distractor
    const m32 = writeOf(r.steps, 3, 2);
    expect(m32.line).toBe(5);
    expect(m32.events).toContainEqual({ t: 'cell', r: 3, c: 2, value: 1, deps: [[2, 2], [3, 1]] });
    if (m32.ask?.kind === 'value') expect(m32.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([[2, 'comparison']]);
    // a match where up/left + 1 differs: dp[7][1] = 1, forgot +1 → 0, read up → 2
    const m71 = writeOf(r.steps, 7, 1);
    if (m71.ask?.kind === 'value') expect(m71.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([[0, 'comparison'], [2, 'dependency']]);

    // read probe on the last column: a mismatch where left wins
    const k26 = r.steps.indexOf(writeOf(r.steps, 2, 6));
    const read26 = must(r.steps[k26 - 1]);
    expect(read26.line).toBe(5);
    expect(read26.events.at(-1)).toEqual({ t: 'compare', a: { cell: [1, 6] }, b: { cell: [2, 5] }, result: '<' });
    expect(read26.ask).toMatchObject({ kind: 'pick', level: 'full', answer: 'c:2,5' });
    if (read26.ask?.kind === 'pick') {
      expect(read26.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([['c:1,6', 'comparison'], ['c:1,5', 'dependency']]);
      expect(read26.ask.candidates).toHaveLength(8 + 6 + 6 + 5); // border + row 1 + dp[2][1..5]
    }
    // a tie reads up
    const k36 = r.steps.indexOf(writeOf(r.steps, 3, 6));
    expect(must(r.steps[k36 - 1]).note).toBe('C ≠ A: up and left tie at 2, and the rule reads up.');
    expect(must(r.steps[k36 - 1]).ask).toMatchObject({ answer: 'c:2,6' });
    // a match on the last column reads the diagonal
    const k16 = r.steps.indexOf(writeOf(r.steps, 1, 6));
    expect(must(r.steps[k16 - 1]).events.at(-1)).toEqual({ t: 'read', ref: { cell: [0, 5] } });
    expect(must(r.steps[k16 - 1]).ask).toMatchObject({ kind: 'pick', answer: 'c:0,5' });

    const w = r.steps.filter((s) => s.phase === 'reconstruct');
    expect(w.map((s) => (s.ask?.kind === 'choice' ? s.ask.answer : null))).toEqual(['up', 'diagonal', 'up', 'diagonal', 'left', 'diagonal', 'left', 'diagonal', null]);
    expect(must(w[0]).events[0]).toEqual({ t: 'mark', ref: { cell: [7, 6] }, as: null }); // clears the active cell
    expect(must(w[0]).events).toContainEqual({ t: 'mark', ref: { cell: [7, 6] }, as: 'visited' });
    expect(must(w[1]).events).toContainEqual({ t: 'mark', ref: { cell: [6, 6] }, as: 'done' });
    expect(must(w[1]).events).toContainEqual({ t: 'var', name: 'lcs', value: '"A"' });
    const tie = must(w[0]).ask;
    if (tie?.kind === 'choice') expect(tie.distractors.map((d) => [d.answer, d.kind])).toEqual([['left', 'comparison'], ['diagonal', 'dependency']]);
    expect(must(w[8]).note).toBe('The walk reaches the border: LCS = BCBA, length 4.');
    expect(must(w[8]).events).toContainEqual({ t: 'mark', ref: { cell: [1, 0] }, as: 'visited' });
    expect(lcs.result(lastState(r), input)).toEqual({ length: 4, lcs: 'BCBA' });
  });

  it('edge presets: empty string, identical, no common letter, one letter, ties', () => {
    const empty = runModule(lcs, preset('empty-string'));
    expect(empty.steps.map((s) => s.line)).toEqual([1, 6]);
    expect(must(empty.steps[1]).note).toBe('One string is empty: the LCS is the empty string, length 0.');
    expect(lcs.result(lastState(empty), preset('empty-string'))).toEqual({ length: 0, lcs: '' });

    const same = runModule(lcs, preset('identical'));
    const walkSame = same.steps.filter((s) => s.phase === 'reconstruct' && s.ask);
    expect(walkSame.every((s) => s.ask?.kind === 'choice' && s.ask.answer === 'diagonal')).toBe(true);
    expect(lcs.result(lastState(same), preset('identical'))).toEqual({ length: 6, lcs: 'DRYRUN' });

    const none = runModule(lcs, preset('no-common-letter'));
    expect(none.steps.filter((s) => s.line === 4 && s.events.some((e) => e.t === 'cell'))).toHaveLength(0);
    expect(must(none.steps.at(-1)).note).toBe('The walk reaches the border: no letter is shared, the LCS is empty.');

    const one = runModule(lcs, preset('one-letter'));
    // n = 1: no match probe, one read probe, one write, one walk step, final
    expect(one.steps.map((s) => s.line)).toEqual([1, 4, 4, 6, 6]);
    expect(lcs.result(lastState(one), preset('one-letter'))).toEqual({ length: 1, lcs: 'A' });

    expect(walkHasTie(preset('tie-heavy'))).toBe(true);
    expect(lcs.result(lastState(runModule(lcs, preset('tie-heavy'))), preset('tie-heavy'))).toEqual({ length: 3, lcs: 'ABA' });
  });

  it('value asks: the answer is what the step writes; distractors are distinct and never the answer', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = runModule(lcs, input);
        r.steps.forEach((s) => {
          if (s.ask?.kind !== 'value') return;
          const cell = must(s.events.find((e) => e.t === 'cell'));
          if (cell.t === 'cell') expect(s.ask.answer).toBe(cell.value);
          const answers = s.ask.distractors.map((d) => d.answer);
          expect(new Set(answers).size).toBe(answers.length);
          expect(answers).not.toContain(s.ask.answer);
        });
      }),
      { numRuns: 300 },
    );
  });

  it('pick asks: a match reads the diagonal; a mismatch names the larger of up and left, up on ties', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = runModule(lcs, input);
        r.steps.forEach((s, k) => {
          if (s.ask?.kind !== 'pick') return;
          const next = must(r.steps[k + 1]);
          const cell = must(next.events.find((e) => e.t === 'cell'));
          if (cell.t !== 'cell') return;
          const { r: i, c: j } = cell;
          const g = must(r.states[k]?.grid);
          const up = must(g.cells[`${i - 1},${j}`]).value;
          const left = must(g.cells[`${i},${j - 1}`]).value;
          const want = input.a[i - 1] === input.b[j - 1] ? `c:${i - 1},${j - 1}` : up >= left ? `c:${i - 1},${j}` : `c:${i},${j - 1}`;
          expect(s.ask.answer).toBe(want);
          expect(j).toBe(input.b.length); // read probes sit on the last column
        });
      }),
      { numRuns: 300 },
    );
  });

  it('walk choice asks: the answer is where the walk goes next', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = runModule(lcs, input);
        const w = walk(input);
        const asks = r.steps.filter((s) => s.phase === 'reconstruct' && s.ask?.kind === 'choice').map((s) => (s.ask?.kind === 'choice' ? s.ask.answer : ''));
        expect(asks).toEqual(w.cells.map((c) => c.move));
      }),
      { numRuns: 300 },
    );
  });

  it('every step and ask obeys the narration and ask rules on presets and random inputs', () => {
    const inputs = [...lcs.presets.map((p) => p.input)];
    for (let i = 0; i < 50; i++) inputs.push(lcs.randomInput(createRng(`n-${i}`)));
    inputs.push({ a: 'ZZZZZZZ', b: 'ZZZZZZZ' }, { a: 'ABCDEFG', b: 'HIJKLMN' });
    for (const input of inputs) {
      const r = runModule(lcs, input);
      for (const s of r.steps) {
        expect(s.note.length).toBeLessThanOrEqual(90);
        expect(s.note).not.toMatch(/\bwe\b/i);
        if (s.ask) {
          expect(s.ask.rule.length).toBeGreaterThan(0);
          expect(s.ask.prompt).not.toMatch(/\bwe\b/i);
          for (const d of s.ask.distractors) expect(d.rule.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('guided asks exist on a typical preset', () => {
    const r = runModule(lcs, preset('classic'));
    expect(askIndices(r.steps, 'guided').length).toBe(42 + 7 + 8); // values + match probes + walk
    expect(askIndices(r.steps, 'full').length).toBe(42 + 7 + 8 + 7);
  });

  it('step count is exact and stays under the cap: the measured worst case is 78 steps (7 × 7)', () => {
    const cases: LcsInput[] = [];
    for (let i = 0; i < 400; i++) {
      const rng = createRng(`cap-${i}`);
      const alpha = 'ABCD'.slice(0, rng.int(1, 4)).split('');
      const w7 = () => Array.from({ length: 7 }, () => rng.pick(alpha)).join('');
      cases.push({ a: w7(), b: w7() });
    }
    // the longest walk, m + n − 1 = 13 cells (found by exhaustive search over two-letter
    // strings): ties go up the last column, then left along row 1, then one diagonal
    cases.push({ a: 'AAAAAAA', b: 'ABBBBBB' });
    let max = 0;
    for (const input of cases) {
      const r = runModule(lcs, input);
      expect(r.truncated).toBe(false);
      expect(r.steps.length).toBe(expectedSteps(input));
      max = Math.max(max, r.steps.length);
    }
    // 1 border + 49 cells + 7 match probes + 7 read probes + at most 13 walk cells + 1 final
    expect(max).toBe(78);
    expect(lcs.meta.caps.maxSteps).toBeGreaterThanOrEqual(Math.ceil(max * 1.1));
  });

  it('the scene builds for every state of every preset', () => {
    for (const p of lcs.presets) {
      const r = runModule(lcs, p.input);
      const layout = computeLayout(r);
      for (const s of r.states) buildScene(s, layout, { width: layout.width });
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'tie', 'long', 'disjoint']) {
      const a = lcs.randomInput(createRng('seed-1'), target);
      const b = lcs.randomInput(createRng('seed-1'), target);
      expect(a).toEqual(b);
      expect(lcs.validate(lcs.encode(a)).ok).toBe(true);
      if (target === 'tie') expect(walkHasTie(a)).toBe(true);
      if (target === 'long') expect(reference(a).length).toBeGreaterThanOrEqual(3);
      if (target === 'disjoint') {
        expect(reference(a).length).toBe(0);
        expect(a.a.length > 0 && a.b.length > 0).toBe(true);
      }
      checkAll(lcs, a);
    }
    expect(lcs.randomInput(createRng('seed-1'))).not.toEqual(lcs.randomInput(createRng('seed-2')));
  });

  it('review targets exercise their mistake kinds (comparison → tie, dependency → long, boundary → long)', () => {
    const kinds = (input: LcsInput): Set<string> => new Set(runModule(lcs, input).steps.flatMap((st) => (st.ask ? st.ask.distractors.map((d) => d.kind) : [])));
    for (let i = 0; i < 30; i++) {
      const tie = lcs.randomInput(createRng(`t-${i}`), 'tie');
      // the walk's tie step: "left" is a comparison mistake (up on ties)
      const tieStep = runModule(lcs, tie).steps.find((st) => st.phase === 'reconstruct' && st.ask?.kind === 'choice' && st.ask.distractors.some((d) => d.rule.includes('tie')));
      expect(tieStep).toBeDefined();
      const long = kinds(lcs.randomInput(createRng(`t-${i}`), 'long'));
      expect(long.has('dependency') && long.has('boundary')).toBe(true);
      expect(kinds(lcs.randomInput(createRng(`t-${i}`), 'disjoint')).has('comparison')).toBe(true);
    }
  });

  it('rejects bad input with actionable sentences', () => {
    expect(lcs.validate({ a: 'ABCBDAB', b: 'BDCABA' })).toEqual({ ok: true, input: { a: 'ABCBDAB', b: 'BDCABA' } });
    expect(lcs.validate({ b: 'ABC' })).toEqual({ ok: true, input: { a: '', b: 'ABC' } }); // an empty a is left out of the URL
    expect(lcs.validate({ a: ' AB ', b: '' })).toEqual({ ok: true, input: { a: 'AB', b: '' } });
    expect(lcs.validate({ a: 'abc', b: 'X' })).toEqual({ ok: false, error: 'Use uppercase letters: write a=ABC, not a=abc.' });
    expect(lcs.validate({ a: 'AB', b: 'A1' })).toEqual({ ok: false, error: 'b may only hold the letters A–Z (found "1").' });
    expect(lcs.validate({ a: 'A B', b: 'A' })).toEqual({ ok: false, error: 'a may only hold the letters A–Z (found " ").' });
    expect(lcs.validate({ a: 'ABCDEFGH', b: 'A' })).toEqual({ ok: false, error: 'a has 8 letters: use at most 7.' });
    expect(lcs.encode({ a: 'AB', b: '' })).toEqual({ a: 'AB', b: '' });
    expect(lcs.decode({ a: 'AB' })).toEqual({ a: 'AB', b: '' });
  });
});
