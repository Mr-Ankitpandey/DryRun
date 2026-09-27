import type { AlgorithmModule } from '@/algorithms/types';
import { cellKey } from '@/engine/ids';
import type { State } from '@/engine/state';
import { applyEvent } from '@/engine/reducer';
import { emptyState } from '@/engine/state';
import { code } from './code';
import type { LcsInput } from './generator';
import { VAR_LCS, generate, gridEvent, quoted, walk } from './generator';
import { MAX_LEN, decode, encode, presets, randomInput, validate } from './input';

export type { LcsInput, Move } from './generator';

export const pseudocode: Record<string, string[]> = {
  bottomup: [
    'for i in 0..m: dp[i][0] = 0;  for j in 0..n: dp[0][j] = 0',
    'for i = 1..m:',
    '    for j = 1..n:',
    '        if a[i-1] == b[j-1]: dp[i][j] = dp[i-1][j-1] + 1',
    '        else: dp[i][j] = max(dp[i-1][j], dp[i][j-1])',
    'reconstruct from (m, n): diagonal on a match, else move to the larger of up/left (up on ties)',
  ],
};

export interface LcsResult {
  length: number;
  lcs: string;
}

/** Reference table, written independently of the generator's `table`. */
export function referenceTable(input: LcsInput): number[][] {
  const { a, b } = input;
  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    dp.push([]);
    for (let j = 0; j <= b.length; j++) {
      let v = 0;
      if (i > 0 && j > 0) {
        const up = (dp[i - 1] as number[])[j] as number;
        const left = (dp[i] as number[])[j - 1] as number;
        v = a.charAt(i - 1) === b.charAt(j - 1) ? ((dp[i - 1] as number[])[j - 1] as number) + 1 : up > left ? up : left;
      }
      (dp[i] as number[]).push(v);
    }
  }
  return dp;
}

/** Plain implementation used by tests: the LCS length and the subsequence the
 *  up-on-ties walk collects. */
export function reference(input: LcsInput): LcsResult {
  const { a, b } = input;
  const dp = referenceTable(input);
  let i = a.length;
  let j = b.length;
  const letters: string[] = [];
  while (i > 0 && j > 0) {
    if (a.charAt(i - 1) === b.charAt(j - 1)) {
      letters.push(a.charAt(i - 1));
      i--;
      j--;
    } else if (((dp[i - 1] as number[])[j] as number) >= ((dp[i] as number[])[j - 1] as number)) i--;
    else j--;
  }
  return { length: (dp[a.length] as number[])[b.length] as number, lcs: letters.reverse().join('') };
}

/** Length from the grid's last cell, subsequence from the `lcs` var. */
function result(final: State, input: LcsInput): LcsResult | null {
  const g = final.grid;
  if (!g) return null;
  const last = g.cells[cellKey(input.a.length, input.b.length)];
  const v = final.vars[VAR_LCS];
  const lcs = typeof v === 'string' && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : null;
  return { length: last ? last.value : NaN, lcs: lcs ?? '<missing>' };
}

/** What holds in every state:
 *  - every filled cell is the LCS length of its two prefixes (checked against
 *    the reference table), with the right dependencies: none on the border,
 *    the diagonal on a match, up and left otherwise;
 *  - the border is filled in one piece, and the inner cells form a row-major
 *    prefix after it;
 *  - at most one cell is `active`;
 *  - `done` / `visited` marks lie on the walk back from (m, n): `done` exactly
 *    on match cells, `visited` on the others and on the border end;
 *  - the `lcs` var holds the letters of the `done` cells, in string order. */
export function invariantCheck(state: State, input: LcsInput): string | null {
  const g = state.grid;
  if (!g) return 'the grid is missing (it is built into the initial state)';
  const { a, b } = input;
  const m = a.length;
  const n = b.length;
  if (g.rows !== m + 1 || g.cols !== n + 1) return `grid is ${g.rows}×${g.cols}, expected ${m + 1}×${n + 1}`;
  const want = reference(input);
  const dp = referenceTable(input);
  let borders = 0;
  let gap = false;
  let active = 0;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      const cell = g.cells[cellKey(i, j)];
      const border = i === 0 || j === 0;
      if (!cell) {
        if (!border) gap = true;
        continue;
      }
      if (border) borders++;
      else if (gap) return `dp[${i}][${j}] is filled before an earlier cell (fill order is row-major)`;
      const expected = (dp[i] as number[])[j] as number;
      if (cell.value !== expected) return `dp[${i}][${j}] = ${cell.value}, but the LCS of "${a.slice(0, i)}" and "${b.slice(0, j)}" has length ${expected}`;
      const deps = border ? [] : a[i - 1] === b[j - 1] ? [[i - 1, j - 1]] : [[i - 1, j], [i, j - 1]];
      if (JSON.stringify(cell.deps) !== JSON.stringify(deps)) return `dp[${i}][${j}] deps ${JSON.stringify(cell.deps)}, expected ${JSON.stringify(deps)}`;
      if (cell.mark === 'active') active++;
    }
  }
  const borderCount = m + n + 1;
  if (borders !== 0 && borders !== borderCount) return `${borders} of ${borderCount} border cells are filled`;
  if (borders === 0 && Object.keys(g.cells).length > 0) return 'inner cells are filled before the border';
  if (active > 1) return `${active} cells are active`;

  const path = walk(input, dp);
  const kind = new Map<string, 'done' | 'visited'>();
  for (const c of path.cells) kind.set(cellKey(c.i, c.j), c.move === 'diagonal' ? 'done' : 'visited');
  kind.set(cellKey(path.end[0], path.end[1]), 'visited');
  let letters = '';
  for (const c of path.cells) {
    const mark = g.cells[cellKey(c.i, c.j)]?.mark ?? null;
    if (mark === 'done') letters = (a[c.i - 1] as string) + letters;
  }
  for (const [key, cell] of Object.entries(g.cells)) {
    if (cell.mark !== 'done' && cell.mark !== 'visited') continue;
    const k = kind.get(key);
    if (!k) return `cell ${key} is marked off the walk back from (${m}, ${n})`;
    if (k !== cell.mark) return `cell ${key} is marked ${cell.mark}, expected ${k}`;
  }
  const v = state.vars[VAR_LCS];
  if (v !== undefined && v !== quoted(letters)) return `lcs = ${String(v)}, but the marked matches spell ${quoted(letters)}`;
  if (!want.lcs.endsWith(letters)) return `collected ${letters} is not a suffix of the LCS ${want.lcs}`;
  return null;
}

export const lcs: AlgorithmModule<LcsInput> = {
  meta: {
    id: 'lcs',
    title: 'Longest common subsequence',
    family: 'dp',
    renderers: ['grid'],
    panels: ['vars'],
    tieBreak: 'Cells fill row by row, left to right; walking back, a match moves diagonally, otherwise toward the larger of up and left, and up on a tie.',
    minutes: 7,
    caps: { maxSteps: 90, maxSize: MAX_LEN },
    variants: [{ id: 'bottomup', title: 'Bottom-up table' }],
  },
  pseudocode,
  code,
  invariant: { bottomup: { name: 'Prefix lengths', sentence: 'Every filled cell is the LCS length of the two prefixes.' } },
  initialState: (input) => applyEvent(emptyState(), gridEvent(input)),
  generate,
  reference,
  result,
  invariantCheck,
  presets,
  randomInput,
  validate,
  encode,
  decode,
  variantOf: () => 'bottomup',
};
