import type { AlgorithmModule } from '@/algorithms/types';
import { cellKey } from '@/engine/ids';
import type { State } from '@/engine/state';
import { emptyState } from '@/engine/state';
import type { KnapsackInput } from './generator';
import { generate, table } from './generator';
import { MAX_ITEMS, decode, encode, presets, randomInput, validate } from './input';

export type { KnapsackInput } from './generator';

export const pseudocode: Record<string, string[]> = {
  bottomup: [
    'dp[0][*] = 0',
    'for i = 1 .. n:',
    '    for c = 0 .. W:',
    '        dp[i][c] = dp[i-1][c]                          // skip item i',
    '        if w[i] <= c:',
    '            dp[i][c] = max(dp[i][c], dp[i-1][c - w[i]] + v[i])   // take item i',
    'reconstruct: from (n, W), if dp[i][c] != dp[i-1][c] item i is taken, c -= w[i]',
  ],
};

export interface KnapsackResult {
  best: number;
  /** 1-based item numbers, ascending. */
  taken: number[];
}

/** Plain implementation used by tests: best value and the items taken when
 *  walking back from (n, W) with ties resolved as "skip". */
export function reference(input: KnapsackInput): KnapsackResult {
  const n = input.w.length;
  const dp: number[][] = [];
  for (let i = 0; i <= n; i++) {
    dp.push([]);
    for (let c = 0; c <= input.W; c++) {
      if (i === 0) {
        (dp[0] as number[]).push(0);
        continue;
      }
      const w = input.w[i - 1] as number;
      const skip = (dp[i - 1] as number[])[c] as number;
      const take = w <= c ? ((dp[i - 1] as number[])[c - w] as number) + (input.v[i - 1] as number) : -1;
      (dp[i] as number[]).push(Math.max(skip, take));
    }
  }
  const taken: number[] = [];
  let c = input.W;
  for (let i = n; i >= 1; i--) {
    if ((dp[i] as number[])[c] !== (dp[i - 1] as number[])[c]) {
      taken.unshift(i);
      c -= input.w[i - 1] as number;
    }
  }
  return { best: (dp[n] as number[])[input.W] as number, taken };
}

/** Best value from the grid's last cell and taken items from the `done` marks. */
function result(final: State, input: KnapsackInput): KnapsackResult | null {
  const g = final.grid;
  if (!g) return null;
  const n = input.w.length;
  const last = g.cells[cellKey(n, input.W)];
  const taken: number[] = [];
  for (let i = 1; i <= n; i++) {
    for (let c = 0; c <= input.W; c++) if (g.cells[cellKey(i, c)]?.mark === 'done') taken.push(i);
  }
  return { best: last ? last.value : NaN, taken };
}

/** What holds in every state:
 *  - computed cells form a row-major prefix of the table (fill order);
 *  - every computed cell holds the true dp value and depends only on the row
 *    above: [i−1, c] and, when w ≤ c, [i−1, c−w] (row 0 has no deps);
 *  - at most one cell is `active`;
 *  - `done` cells are where dp[i][c] ≠ dp[i−1][c] (item taken), `visited` cells
 *    (rows ≥ 1) are where they are equal, and both lie on the walk from (n, W). */
export function invariantCheck(state: State, input: KnapsackInput): string | null {
  const g = state.grid;
  if (!g) return null; // before setup
  const n = input.w.length;
  const W = input.W;
  if (g.rows !== n + 1 || g.cols !== W + 1) return `grid is ${g.rows}×${g.cols}, expected ${n + 1}×${W + 1}`;
  const dp = table(input);
  let gapSeen = false;
  let active = 0;
  for (let i = 0; i <= n; i++) {
    for (let c = 0; c <= W; c++) {
      const cell = g.cells[cellKey(i, c)];
      if (!cell) {
        gapSeen = true;
        continue;
      }
      if (gapSeen) return `dp[${i}][${c}] is computed before an earlier cell (fill order is row-major)`;
      const want = (dp[i] as number[])[c] as number;
      if (cell.value !== want) return `dp[${i}][${c}] = ${cell.value}, expected ${want}`;
      const w = input.w[i - 1] ?? 0;
      const deps = i === 0 ? [] : w <= c ? [[i - 1, c], [i - 1, c - w]] : [[i - 1, c]];
      if (JSON.stringify(cell.deps) !== JSON.stringify(deps)) return `dp[${i}][${c}] deps ${JSON.stringify(cell.deps)}, expected ${JSON.stringify(deps)}`;
      if (cell.mark === 'active') active++;
    }
  }
  if (active > 1) return `${active} cells are active`;
  // Walk from (n, W): marks may only sit on the path, with the right kind.
  const onPath = new Set<string>();
  let c = W;
  for (let i = n; i >= 0; i--) {
    onPath.add(cellKey(i, c));
    if (i === 0) break;
    const taken = (dp[i] as number[])[c] !== (dp[i - 1] as number[])[c];
    const mark = g.cells[cellKey(i, c)]?.mark ?? null;
    if (mark === 'done' && !taken) return `dp[${i}][${c}] is marked taken but equals the cell above`;
    if (mark === 'visited' && taken) return `dp[${i}][${c}] is marked skipped but differs from the cell above`;
    if (taken) c -= input.w[i - 1] as number;
  }
  for (const [key, cell] of Object.entries(g.cells)) {
    if ((cell.mark === 'done' || cell.mark === 'visited') && !onPath.has(key)) return `cell ${key} is marked off the reconstruction path`;
  }
  return null;
}

export const knapsack: AlgorithmModule<KnapsackInput> = {
  meta: {
    id: 'knapsack',
    title: '0/1 knapsack',
    family: 'dp',
    renderers: ['grid'],
    panels: [],
    tieBreak: 'Cells fill row by row, left to right; when taking and skipping tie, the item is not taken (dp[i][c] = dp[i−1][c] means skip).',
    minutes: 6,
    caps: { maxSteps: 80, maxSize: MAX_ITEMS },
    variants: [{ id: 'bottomup', title: 'Bottom-up table' }],
  },
  pseudocode,
  invariant: { bottomup: { name: 'Row above only', sentence: 'dp[i][c] uses only the row above.' } },
  initialState: () => emptyState(),
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
