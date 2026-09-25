/** 0/1 knapsack, bottom-up table. See docs/ALGORITHMS.md §8.
 *  Grid rows are items 0..n (row 0 = no items), columns are capacities 0..W.
 *  Step rhythm:
 *    row 0 (line 1): the grid and W + 1 zero cells in one step →
 *    per (i, c), row-major: one write step (line 4 when item i does not fit,
 *    line 6 when it does) with `cell` deps [i−1, c] and, if w ≤ c, [i−1, c−w];
 *    the new cell is `mark active` (the renderer draws its dependency arrows)
 *    and the previous active cell is cleared. The value ask sits on this step,
 *    so it is asked before the write. On the last column of each row where the
 *    item fits, one extra probe step (line 5) comes first: it `read`s both
 *    dependencies and asks which cell besides the one above is read →
 *    reconstruction (line 7): from (n, W) up to row 1, one step per row: `read`
 *    dp[i][c] and dp[i−1][c]; taken (they differ) → `mark done`, c −= w;
 *    not taken → `mark visited`. A tie (take = skip) counts as not taken →
 *    a final step marks the row-0 end of the path and states the answer. */

import type { Id, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Distractor } from '@/trace/asks';

export interface KnapsackInput {
  /** Weights of items 1..n (index 0 is item 1). */
  w: number[];
  /** Values of items 1..n. */
  v: number[];
  /** Capacity. */
  W: number;
}

const RULE_VALUE = 'dp[i][c] is the larger of skip, dp[i−1][c], and take, dp[i−1][c−w] + v, when w ≤ c.';
const RULE_MAX = 'Both options are computed and dp keeps the larger one.';
const RULE_ROW = 'Take reads the row above, dp[i−1][c−w]: reading row i would reuse item i (unbounded).';
const RULE_FIT = 'An item fits only when w ≤ c; otherwise dp[i][c] copies the cell above.';
const RULE_DEP = 'Taking item i leaves capacity c − w for items 1..i−1: that is dp[i−1][c−w].';
const RULE_JUMP = 'The take option jumps back w columns in the row above, not one column.';
const RULE_TAKEN = 'Item i is taken only when dp[i][c] differs from dp[i−1][c]; on a tie it is skipped.';

/** The full table, dp[i][c]. */
export function table(input: KnapsackInput): number[][] {
  const n = input.w.length;
  const dp: number[][] = [Array.from({ length: input.W + 1 }, () => 0)];
  for (let i = 1; i <= n; i++) {
    const w = input.w[i - 1] as number;
    const v = input.v[i - 1] as number;
    const prev = dp[i - 1] as number[];
    dp.push(prev.map((skip, c) => (w <= c ? Math.max(skip, (prev[c - w] as number) + v) : skip)));
  }
  return dp;
}

export const rowLabel = (input: KnapsackInput, i: number): string => (i === 0 ? '0' : `item ${i} (${input.w[i - 1]}, ${input.v[i - 1]})`);

export function* generate(input: KnapsackInput): Iterable<Step> {
  const n = input.w.length;
  const W = input.W;
  const dp = table(input);
  const at = (i: number, c: number): number => (dp[i] as number[])[c] as number;

  const first: VizEvent[] = [
    {
      t: 'grid',
      rows: n + 1,
      cols: W + 1,
      rowLabels: Array.from({ length: n + 1 }, (_, i) => rowLabel(input, i)),
      colLabels: Array.from({ length: W + 1 }, (_, c) => String(c)),
    },
  ];
  for (let c = 0; c <= W; c++) first.push({ t: 'cell', r: 0, c, value: 0, deps: [] });
  yield { line: 1, events: first, note: 'Row 0 is all zeros: with no items to take, the best value is 0.', phase: 'fill' };

  let active: [number, number] | null = null;
  const clearActive = (): VizEvent[] => (active ? [{ t: 'mark', ref: { cell: active }, as: null }] : []);

  for (let i = 1; i <= n; i++) {
    const w = input.w[i - 1] as number;
    const v = input.v[i - 1] as number;
    for (let c = 0; c <= W; c++) {
      const fits = w <= c;
      const skip = at(i - 1, c);
      const take = fits ? at(i - 1, c - w) + v : null;
      const value = at(i, c);

      if (fits && c === W) {
        const candidates: Id[] = [];
        for (let x = 0; x <= W; x++) candidates.push(ids.cell(i - 1, x));
        for (let x = 0; x < c; x++) candidates.push(ids.cell(i, x));
        const distractors: Distractor<Id>[] = [{ answer: ids.cell(i, c - w), kind: 'dependency', rule: RULE_ROW }];
        if (w !== 1) distractors.push({ answer: ids.cell(i - 1, c - 1), kind: 'dependency', rule: RULE_JUMP });
        yield {
          line: 5,
          events: [
            { t: 'read', ref: { cell: [i - 1, c] } },
            { t: 'read', ref: { cell: [i - 1, c - w] } },
          ],
          note: `Item ${i} fits (w ${w} ≤ ${c}): dp[${i}][${c}] reads dp[${i - 1}][${c}] and dp[${i - 1}][${c - w}].`,
          phase: 'fill',
          ask: {
            kind: 'pick',
            level: 'full',
            prompt: `dp[${i}][${c}] reads dp[${i - 1}][${c}] above. Which other cell does it read?`,
            answer: ids.cell(i - 1, c - w),
            candidates,
            rule: RULE_DEP,
            distractors,
          },
        };
      }

      const deps: [number, number][] = fits ? [[i - 1, c], [i - 1, c - w]] : [[i - 1, c]];
      const events: VizEvent[] = [...clearActive(), { t: 'cell', r: i, c, value, deps }, { t: 'mark', ref: { cell: [i, c] }, as: 'active' }];
      active = [i, c];
      const distractors: Distractor<number>[] = [];
      const add = (answer: number, kind: Distractor<number>['kind'], rule: string) => {
        if (answer === value || distractors.some((d) => d.answer === answer)) return;
        distractors.push({ answer, kind, rule });
      };
      let note: string;
      if (take === null) {
        add(skip + v, 'comparison', RULE_FIT);
        note = `Item ${i} does not fit (w ${w} > ${c}): copy dp[${i - 1}][${c}] = ${skip}.`;
      } else {
        if (take < skip) add(take, 'comparison', RULE_MAX);
        add(at(i, c - w) + v, 'dependency', RULE_ROW);
        if (take > skip) add(skip, 'comparison', RULE_MAX);
        note =
          take > skip
            ? `Take item ${i}: dp[${i - 1}][${c - w}] + ${v} = ${take} beats skipping it (${skip}).`
            : take < skip
              ? `Skip item ${i}: ${skip} from above beats taking it (${take}).`
              : `Take and skip tie at ${value}, so dp[${i}][${c}] = ${value}.`;
      }
      yield {
        line: fits ? 6 : 4,
        events,
        note,
        phase: 'fill',
        ask: { kind: 'value', level: 'guided', prompt: `Item ${i} (w ${w}, v ${v}), capacity ${c}. Value of dp[${i}][${c}]?`, answer: value, rule: RULE_VALUE, distractors },
      };
    }
  }

  // ---- reconstruction
  let c = W;
  const taken: number[] = [];
  for (let i = n; i >= 1; i--) {
    const w = input.w[i - 1] as number;
    const here = at(i, c);
    const above = at(i - 1, c);
    const isTaken = here !== above;
    const events: VizEvent[] = [
      ...clearActive(),
      { t: 'read', ref: { cell: [i, c] } },
      { t: 'read', ref: { cell: [i - 1, c] } },
      { t: 'mark', ref: { cell: [i, c] }, as: isTaken ? 'done' : 'visited' },
    ];
    active = null;
    yield {
      line: 7,
      events,
      note: isTaken
        ? `dp[${i}][${c}] = ${here} ≠ dp[${i - 1}][${c}] = ${above}: item ${i} is taken, c = ${c} − ${w} = ${c - w}.`
        : `dp[${i}][${c}] = dp[${i - 1}][${c}] = ${here}: item ${i} is not taken.`,
      phase: 'reconstruct',
      ask: {
        kind: 'choice',
        level: 'full',
        prompt: `At dp[${i}][${c}]: is item ${i} taken in the answer?`,
        options: ['yes', 'no'],
        answer: isTaken ? 'yes' : 'no',
        rule: RULE_TAKEN,
        distractors: [{ answer: isTaken ? 'no' : 'yes', kind: 'dependency', rule: RULE_TAKEN }],
      },
    };
    if (isTaken) {
      taken.unshift(i);
      c -= w;
    }
  }
  const best = at(n, W);
  const weight = taken.reduce((s, i) => s + (input.w[i - 1] as number), 0);
  yield {
    line: 7,
    events: [...clearActive(), { t: 'mark', ref: { cell: [0, c] }, as: 'visited' }],
    note:
      taken.length === 0
        ? 'The walk reaches row 0 with nothing taken: the best value is 0.'
        : `${taken.length === 1 ? 'Item' : 'Items'} ${taken.join(', ')}: value ${best}, weight ${weight} of ${W}.`,
    phase: 'reconstruct',
  };
}
