/** Longest common subsequence, bottom-up table, then a walk back from (m, n).
 *  Grid rows are prefixes of a (row 0 = empty, row i ends with a[i−1]), columns
 *  are prefixes of b. The empty grid is part of the initial state (see
 *  `gridEvent`), so the stage shows it before the first step. Step rhythm:
 *    borders (line 1): row 0 and column 0 as zeros, in one step →
 *    per (i, j), row-major: one write step (line 4 on a match, line 5 otherwise):
 *    the letters a[i−1] and b[j−1] as vars with a `compare`, the `cell` with its
 *    deps ([i−1, j−1] on a match, [i−1, j] and [i, j−1] otherwise), the new cell
 *    `mark active` and the previous one cleared, so dependency arrows draw.
 *    The value ask sits on this step. Two probes come before some writes:
 *    on the first column of every row (when there are 2+ columns) a match probe
 *    (`compare` of the letters, asks whether they match); on the last column of
 *    every row a read probe (`read` of the diagonal on a match, `compare` of up
 *    and left otherwise; asks which cell is read) →
 *    reconstruction (line 6): from (m, n) while i, j > 0, one step per cell
 *    (`read` of the cell, the letters compared again): a match is marked `done` (its letter joins the answer) and the walk moves
 *    diagonally; otherwise the cell is marked `visited` and the walk moves to the
 *    larger of up and left, up on a tie. The collected letters live in the var
 *    `lcs` (quoted). A final step marks the border cell where the walk ends. */

import type { Id, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Distractor } from '@/trace/asks';

export interface LcsInput {
  a: string;
  b: string;
}

export type Move = 'diagonal' | 'up' | 'left';

const VAR_A = 'a[i-1]';
const VAR_B = 'b[j-1]';
export const VAR_LCS = 'lcs';

const RULE_VALUE = 'On a match dp[i][j] = dp[i−1][j−1] + 1; otherwise it is the max of up and left.';
const RULE_PLUS_ONE = 'A match extends the common subsequence of both shorter prefixes by one: diagonal + 1.';
const RULE_NO_PLUS = 'No match, no +1: the letters differ, so dp takes the better of up and left.';
const RULE_MAX = 'dp keeps the longer subsequence: the max of up and left, never the min.';
const RULE_DIAG_ONLY = 'On a match the +1 goes on the diagonal dp[i−1][j−1], not on up or left.';
const RULE_UP_LEFT = 'On a mismatch dp reads up and left; the diagonal is only for a match.';
const RULE_MATCH = 'Row i is labelled a[i−1] and column j is labelled b[j−1]: dp[i][j] compares exactly those two.';
const RULE_READ = 'A match reads the diagonal; a mismatch reads up and left and keeps the larger (up on a tie).';
const RULE_BOTH_USED = 'Both letters are used up by a match, so dp[i][j] reads the cell where both prefixes are one shorter.';
const RULE_LARGER = 'The max comes from the larger of up and left.';
const RULE_TIE = 'On a tie the rule reads up, dp[i−1][j]; both give the same value.';
const RULE_WALK = 'A match moves diagonally and keeps the letter; otherwise move to the larger of up and left, up on a tie.';
const RULE_WALK_MATCH = 'When the letters match, the walk moves diagonally and keeps the letter.';
const RULE_WALK_MISMATCH = 'No match: the value came from up or left, not the diagonal.';
const RULE_WALK_LARGER = 'Move toward the larger neighbour: that is where the value came from.';
const RULE_WALK_TIE = 'On a tie the walk moves up.';

/** The full table, dp[i][j] = LCS length of a[0..i) and b[0..j). */
export function table(input: LcsInput): number[][] {
  const { a, b } = input;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }, () => 0));
  for (let i = 1; i <= a.length; i++) {
    const row = dp[i] as number[];
    const up = dp[i - 1] as number[];
    for (let j = 1; j <= b.length; j++) {
      row[j] = a[i - 1] === b[j - 1] ? (up[j - 1] as number) + 1 : Math.max(up[j] as number, row[j - 1] as number);
    }
  }
  return dp;
}

/** The walk back from (m, n): each visited cell with its move, and where it ends. */
export function walk(input: LcsInput, dp: number[][] = table(input)): { cells: { i: number; j: number; move: Move }[]; end: [number, number]; lcs: string } {
  const cells: { i: number; j: number; move: Move }[] = [];
  let i = input.a.length;
  let j = input.b.length;
  let lcs = '';
  while (i > 0 && j > 0) {
    if (input.a[i - 1] === input.b[j - 1]) {
      cells.push({ i, j, move: 'diagonal' });
      lcs = (input.a[i - 1] as string) + lcs;
      i--;
      j--;
    } else if (((dp[i - 1] as number[])[j] as number) >= ((dp[i] as number[])[j - 1] as number)) {
      cells.push({ i, j, move: 'up' });
      i--;
    } else {
      cells.push({ i, j, move: 'left' });
      j--;
    }
  }
  return { cells, end: [i, j], lcs };
}

export const quoted = (s: string): string => `"${s}"`;

/** The empty table, built into the initial state so the stage shows it at step 0. */
export function gridEvent(input: LcsInput): VizEvent {
  return { t: 'grid', rows: input.a.length + 1, cols: input.b.length + 1, rowLabels: ['', ...input.a.split('')], colLabels: ['', ...input.b.split('')] };
}

export function* generate(input: LcsInput): Iterable<Step> {
  const { a, b } = input;
  const m = a.length;
  const n = b.length;
  const dp = table(input);
  const at = (i: number, j: number): number => (dp[i] as number[])[j] as number;
  const A = (i: number): string => a[i - 1] as string;
  const B = (j: number): string => b[j - 1] as string;

  const first: VizEvent[] = [];
  for (let i = 0; i <= m; i++) first.push({ t: 'cell', r: i, c: 0, value: 0, deps: [] });
  for (let j = 1; j <= n; j++) first.push({ t: 'cell', r: 0, c: j, value: 0, deps: [] });
  yield { line: 1, events: first, note: 'Row 0 and column 0 are 0: an empty prefix has nothing in common.', phase: 'fill' };

  let active: [number, number] | null = null;
  const clearActive = (): VizEvent[] => {
    const out: VizEvent[] = active ? [{ t: 'mark', ref: { cell: active }, as: null }] : [];
    active = null;
    return out;
  };
  const letters = (i: number, j: number): VizEvent[] => {
    const match = A(i) === B(j);
    return [
      { t: 'var', name: VAR_A, value: A(i) },
      { t: 'var', name: VAR_B, value: B(j) },
      match ? { t: 'compare', a: { var: VAR_A }, b: { var: VAR_B }, result: '=' } : { t: 'compare', a: { var: VAR_A }, b: { var: VAR_B } },
    ];
  };
  const computed = (i: number, j: number): Id[] => {
    // Every cell already in the table before (i, j): borders and the row-major prefix.
    const out: Id[] = [];
    for (let r = 0; r <= m; r++) {
      for (let c = 0; c <= n; c++) {
        const border = r === 0 || c === 0;
        if (border || r < i || (r === i && c < j)) out.push(ids.cell(r, c));
      }
    }
    return out;
  };

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = A(i) === B(j);
      const diag = at(i - 1, j - 1);
      const up = at(i - 1, j);
      const left = at(i, j - 1);
      const value = at(i, j);

      if (j === 1 && n >= 2) {
        yield {
          line: 4,
          events: letters(i, j),
          note: match ? `a[${i - 1}] = ${A(i)} and b[${j - 1}] = ${B(j)} match.` : `a[${i - 1}] = ${A(i)} and b[${j - 1}] = ${B(j)} differ.`,
          phase: 'fill',
          ask: {
            kind: 'choice',
            level: 'guided',
            prompt: `dp[${i}][${j}] compares a[${i - 1}] with b[${j - 1}]. Do they match?`,
            options: ['yes', 'no'],
            answer: match ? 'yes' : 'no',
            rule: RULE_MATCH,
            distractors: [{ answer: match ? 'no' : 'yes', kind: 'boundary', rule: RULE_MATCH }],
          },
        };
      }

      if (j === n) {
        const dCell = ids.cell(i - 1, j - 1);
        const uCell = ids.cell(i - 1, j);
        const lCell = ids.cell(i, j - 1);
        if (match) {
          yield {
            line: 4,
            events: [...letters(i, j), { t: 'read', ref: { cell: [i - 1, j - 1] } }],
            note: `${A(i)} = ${B(j)}: dp[${i}][${j}] reads the diagonal dp[${i - 1}][${j - 1}] = ${diag}.`,
            phase: 'fill',
            ask: {
              kind: 'pick',
              level: 'full',
              prompt: `a[${i - 1}] = b[${j - 1}] = ${A(i)}. Which cell does dp[${i}][${j}] read?`,
              answer: dCell,
              candidates: computed(i, j),
              rule: RULE_BOTH_USED,
              distractors: [
                { answer: uCell, kind: 'dependency', rule: RULE_BOTH_USED },
                { answer: lCell, kind: 'dependency', rule: RULE_BOTH_USED },
              ],
            },
          };
        } else {
          const fromUp = up >= left;
          const answer = fromUp ? uCell : lCell;
          const other = fromUp ? lCell : uCell;
          const distractors: Distractor<Id>[] = [
            { answer: other, kind: 'comparison', rule: up === left ? RULE_TIE : RULE_LARGER },
            { answer: dCell, kind: 'dependency', rule: RULE_UP_LEFT },
          ];
          yield {
            line: 5,
            events: [...letters(i, j), { t: 'compare', a: { cell: [i - 1, j] }, b: { cell: [i, j - 1] }, result: up < left ? '<' : up === left ? '=' : '>' }],
            note:
              up === left
                ? `${A(i)} ≠ ${B(j)}: up and left tie at ${up}, and the rule reads up.`
                : `${A(i)} ≠ ${B(j)}: ${fromUp ? `up ${up} > left ${left}` : `left ${left} > up ${up}`}, so the max comes from ${fromUp ? 'up' : 'the left'}.`,
            phase: 'fill',
            ask: {
              kind: 'pick',
              level: 'full',
              prompt: `${A(i)} ≠ ${B(j)}. Which neighbour gives dp[${i}][${j}] its max? (Ties read up.)`,
              answer,
              candidates: computed(i, j),
              rule: RULE_READ,
              distractors,
            },
          };
        }
      }

      const deps: [number, number][] = match ? [[i - 1, j - 1]] : [[i - 1, j], [i, j - 1]];
      const events: VizEvent[] = [...clearActive(), ...letters(i, j), { t: 'cell', r: i, c: j, value, deps }, { t: 'mark', ref: { cell: [i, j] }, as: 'active' }];
      active = [i, j];
      const distractors: Distractor<number>[] = [];
      const add = (x: number, kind: Distractor<number>['kind'], rule: string) => {
        if (x === value || distractors.some((d) => d.answer === x)) return;
        distractors.push({ answer: x, kind, rule });
      };
      if (match) {
        add(diag, 'comparison', RULE_PLUS_ONE);
        add(Math.max(up, left) + 1, 'dependency', RULE_DIAG_ONLY);
      } else {
        add(diag + 1, 'comparison', RULE_NO_PLUS);
        add(Math.min(up, left), 'comparison', RULE_MAX);
        add(diag, 'dependency', RULE_UP_LEFT);
      }
      yield {
        line: match ? 4 : 5,
        events,
        note: match
          ? `${A(i)} = ${B(j)}: dp[${i}][${j}] = dp[${i - 1}][${j - 1}] + 1 = ${value}.`
          : `${A(i)} ≠ ${B(j)}: dp[${i}][${j}] = max(up ${up}, left ${left}) = ${value}.`,
        phase: 'fill',
        ask: { kind: 'value', level: 'guided', prompt: `Value of dp[${i}][${j}] (${A(i)} vs ${B(j)})?`, answer: value, rule: RULE_VALUE, distractors },
      };
    }
  }

  // ---- reconstruction
  const path = walk(input, dp);
  let lcs = '';
  for (const { i, j, move } of path.cells) {
    const events: VizEvent[] = [...clearActive(), ...letters(i, j), { t: 'read', ref: { cell: [i, j] } }];
    if (move === 'diagonal') {
      lcs = A(i) + lcs;
      events.push({ t: 'read', ref: { cell: [i - 1, j - 1] } }, { t: 'mark', ref: { cell: [i, j] }, as: 'done' }, { t: 'var', name: VAR_LCS, value: quoted(lcs) });
    } else {
      const up = at(i - 1, j);
      const left = at(i, j - 1);
      events.push(
        { t: 'compare', a: { cell: [i - 1, j] }, b: { cell: [i, j - 1] }, result: up < left ? '<' : up === left ? '=' : '>' },
        { t: 'mark', ref: { cell: [i, j] }, as: 'visited' },
        { t: 'var', name: VAR_LCS, value: quoted(lcs) },
      );
    }
    const distractors: Distractor<string>[] = [];
    if (move === 'diagonal') {
      distractors.push({ answer: 'up', kind: 'dependency', rule: RULE_WALK_MATCH }, { answer: 'left', kind: 'dependency', rule: RULE_WALK_MATCH });
    } else {
      const tie = at(i - 1, j) === at(i, j - 1);
      distractors.push({ answer: move === 'up' ? 'left' : 'up', kind: 'comparison', rule: tie ? RULE_WALK_TIE : RULE_WALK_LARGER });
      distractors.push({ answer: 'diagonal', kind: 'dependency', rule: RULE_WALK_MISMATCH });
    }
    const up = at(i - 1, j);
    const left = at(i, j - 1);
    yield {
      line: 6,
      events,
      note:
        move === 'diagonal'
          ? `${A(i)} = ${B(j)} at dp[${i}][${j}]: ${A(i)} joins the LCS, move diagonally.`
          : up === left
            ? `${A(i)} ≠ ${B(j)} at dp[${i}][${j}]: up and left tie at ${up}, move up.`
            : `${A(i)} ≠ ${B(j)} at dp[${i}][${j}]: ${move === 'up' ? `up ${up} > left ${left}, move up` : `left ${left} > up ${up}, move left`}.`,
      phase: 'reconstruct',
      ask: {
        kind: 'choice',
        level: 'guided',
        prompt: `At dp[${i}][${j}] (${A(i)} vs ${B(j)}): move diagonal, up or left?`,
        options: ['diagonal', 'up', 'left'],
        answer: move,
        rule: RULE_WALK,
        distractors,
      },
    };
  }
  const [ei, ej] = path.end;
  yield {
    line: 6,
    events: [...clearActive(), { t: 'mark', ref: { cell: [ei, ej] }, as: 'visited' }, { t: 'var', name: VAR_LCS, value: quoted(path.lcs) }],
    note:
      m === 0 || n === 0
        ? 'One string is empty: the LCS is the empty string, length 0.'
        : path.lcs === ''
          ? 'The walk reaches the border: no letter is shared, the LCS is empty.'
          : `The walk reaches the border: LCS = ${path.lcs}, length ${path.lcs.length}.`,
    phase: 'reconstruct',
  };
}
