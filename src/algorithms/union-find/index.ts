import type { AlgorithmModule } from '@/algorithms/types';
import { applyEvent } from '@/engine/reducer';
import type { State } from '@/engine/state';
import { arrayValues, emptyState, withArray } from '@/engine/state';
import { code } from './code';
import { PARENT, generate, structure } from './generator';
import { MAX_NODES, decode, encode, presets, randomInput, validate } from './input';
import type { UfInput, UfResult } from './model';
import { partitionAfter, runOps } from './model';

export type { UfInput, UfOp, UfResult } from './model';

export const pseudocode: Record<string, string[]> = {
  rank: [
    'find(x):',
    '    r = x',
    '    while parent[r] != r: r = parent[r]',
    '    while parent[x] != r:                 // path compression',
    '        next = parent[x]; parent[x] = r; x = next',
    '    return r',
    'union(a, b):',
    '    ra = find(a); rb = find(b)',
    '    if ra == rb: return                   // already in the same set',
    '    if rank[ra] < rank[rb]: swap ra, rb   // the larger rank goes on top',
    '    else if rank[ra] == rank[rb] and rb < ra: swap ra, rb   // tie: smaller id',
    '    parent[rb] = ra',
    '    if rank[ra] == rank[rb]: rank[ra] = rank[ra] + 1',
  ],
};

export function reference(input: UfInput): UfResult {
  return runOps(input).result;
}

const idOf = (id: string): number => Number(id.slice(2));

function rankOf(text: string | null | undefined): number | null {
  const m = typeof text === 'string' ? /^rank (\d+)$/.exec(text) : null;
  return m ? Number(m[1]) : null;
}

function result(final: State, input: UfInput): UfResult {
  const parent = arrayValues(final, PARENT).map((v) => v ?? -1);
  const rank = Array.from({ length: input.n }, (_, v) => rankOf(final.tree[`n:${v}`]?.text));
  const finds = typeof final.vars.finds === 'string' && final.vars.finds !== '' ? final.vars.finds.split(',').map(Number) : [];
  return { parent, rank, finds };
}

/** What holds in every state:
 *  - parent[] and the drawn forest agree (a root points to itself);
 *  - exactly the roots carry a rank label;
 *  - union by rank: a root of rank k has a tree at most k high and at least
 *    2^k nodes;
 *  - the sets are the reference's sets before or after the operation in
 *    progress (path compression never changes a set). */
export function invariantCheck(state: State, input: UfInput): string | null {
  const values = arrayValues(state, PARENT);
  if (!state.forest) return 'not a forest';
  for (let v = 0; v < input.n; v++) {
    const node = state.tree[`n:${v}`];
    if (!node) return `node ${v} missing`;
    const drawn = node.parent === null ? v : idOf(node.parent);
    if (values[v] !== drawn) return `parent[${v}] = ${String(values[v])} but the forest shows ${drawn}`;
    const rank = rankOf(node.text);
    if ((node.parent === null) !== (rank !== null)) return `${v}: ${node.parent === null ? 'root without a rank label' : 'non-root with a rank label'}`;
  }
  const children = new Map<number, number[]>();
  for (let v = 0; v < input.n; v++) if (values[v] !== v) children.set(values[v] as number, [...(children.get(values[v] as number) ?? []), v]);
  const measure = (v: number, seen: Set<number>): { size: number; height: number } => {
    if (seen.has(v)) throw new Error(`cycle through ${v}`);
    seen.add(v);
    let size = 1;
    let height = 0;
    for (const c of children.get(v) ?? []) {
      const m = measure(c, seen);
      size += m.size;
      height = Math.max(height, m.height + 1);
    }
    return { size, height };
  };
  const groups: string[] = [];
  for (let v = 0; v < input.n; v++) {
    if (values[v] !== v) continue;
    const rank = rankOf(state.tree[`n:${v}`]?.text) as number;
    let m: { size: number; height: number };
    try {
      m = measure(v, new Set());
    } catch (e) {
      return String(e);
    }
    if (m.height > rank) return `root ${v}: height ${m.height} > rank ${rank}`;
    if (m.size < 2 ** rank) return `root ${v}: ${m.size} nodes < 2^${rank}`;
    const members: number[] = [];
    const collect = (x: number) => {
      members.push(x);
      for (const c of children.get(x) ?? []) collect(c);
    };
    collect(v);
    groups.push(members.sort((p, q) => p - q).join(','));
  }
  const now = groups.sort().join(' | ');
  const k = typeof state.vars.op === 'number' ? state.vars.op : 0;
  if (now !== partitionAfter(input, k) && now !== partitionAfter(input, Math.max(0, k - 1))) return `sets ${now} match neither before nor after operation ${k}`;
  return null;
}

export const unionFind: AlgorithmModule<UfInput> = {
  meta: {
    id: 'union-find',
    title: 'Union-find (rank + path compression)',
    family: 'tree',
    renderers: ['array', 'tree'],
    panels: ['vars'],
    tieBreak: 'Union by rank: the larger rank becomes the parent, and on equal ranks the smaller id.',
    minutes: 5,
    caps: { maxSteps: 90, maxSize: MAX_NODES },
    variants: [{ id: 'rank', title: 'Union by rank, path compression' }],
    fieldLabels: { n: 'Number of elements', ops: 'Operations (u0-1 joins, f3 finds)' },
  },
  pseudocode,
  code,
  invariant: { rank: { name: 'Rank bounds the height', sentence: "Every element points towards its root, and a root's rank is at least its tree's height." } },
  initialState: (input) => structure(input).reduce(applyEvent, withArray(emptyState(), PARENT, Array.from({ length: input.n }, (_, v) => v))),
  generate,
  reference,
  result,
  invariantCheck,
  presets,
  randomInput,
  validate,
  encode,
  decode,
  variantOf: () => 'rank',
};
