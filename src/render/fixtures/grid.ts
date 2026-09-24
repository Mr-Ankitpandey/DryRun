/** 3×4 DP grid fixture (minimum path sum): each cell is computed from its
 *  up/left neighbours; the cell being computed carries mark 'active' and its
 *  dependencies are read in the same step. */

import type { Step } from '@/engine/events';
import { emptyState } from '@/engine/state';
import type { Fixture } from './types';

const cost = [
  [1, 3, 1, 2],
  [1, 5, 1, 4],
  [4, 2, 1, 1],
];
const ROWS = 3;
const COLS = 4;

function build(): Step[] {
  const steps: Step[] = [
    {
      line: 1,
      events: [{ t: 'grid', rows: ROWS, cols: COLS, rowLabels: ['r0', 'r1', 'r2'], colLabels: ['c0', 'c1', 'c2', 'c3'] }],
      note: 'dp[r][c] = cost[r][c] + min(dp[r-1][c], dp[r][c-1]).',
      phase: 'setup',
    },
  ];
  const dp: number[][] = [];
  let prev: [number, number] | null = null;
  for (let r = 0; r < ROWS; r++) {
    dp[r] = [];
    for (let c = 0; c < COLS; c++) {
      const deps: [number, number][] = [];
      if (r > 0) deps.push([r - 1, c]);
      if (c > 0) deps.push([r, c - 1]);
      const best = deps.length ? Math.min(...deps.map(([dr, dc]) => (dp[dr] as number[])[dc] as number)) : 0;
      const value = ((cost[r] as number[])[c] as number) + best;
      (dp[r] as number[])[c] = value;
      const events: Step['events'] = [];
      if (prev) events.push({ t: 'mark', ref: { cell: prev }, as: null });
      for (const d of deps) events.push({ t: 'read', ref: { cell: d } });
      events.push({ t: 'cell', r, c, value, deps }, { t: 'mark', ref: { cell: [r, c] }, as: 'active' });
      const via = deps.length === 0 ? 'the start' : deps.length === 1 ? `its only neighbour (${best})` : `min(${deps.map(([dr, dc]) => (dp[dr] as number[])[dc]).join(', ')}) = ${best}`;
      steps.push({ line: deps.length === 0 ? 2 : 3, events, note: `dp[${r}][${c}] = ${(cost[r] as number[])[c]} + ${best} = ${value}, from ${via}.`, phase: `row ${r}` });
      prev = [r, c];
    }
  }
  steps.push({
    line: 4,
    events: [{ t: 'mark', ref: { cell: [ROWS - 1, COLS - 1] }, as: 'done' }, { t: 'var', name: 'answer', value: (dp[ROWS - 1] as number[])[COLS - 1] as number }],
    note: `The answer is the bottom-right cell: ${(dp[ROWS - 1] as number[])[COLS - 1]}.`,
    phase: 'done',
  });
  return steps;
}

export const gridFixture: Fixture = {
  id: 'grid',
  title: 'Min path sum (3×4 DP grid)',
  pseudocode: ['dp = grid of rows × cols', 'dp[0][0] = cost[0][0]', 'dp[r][c] = cost[r][c] + min(up, left)', 'return dp[rows-1][cols-1]'],
  initial: emptyState(),
  steps: build(),
};
