import type { AlgorithmModule } from '@/algorithms/types';
import { ids } from '@/engine/ids';
import type { State } from '@/engine/state';
import { emptyState } from '@/engine/state';
import type { DijkstraInput } from './generator';
import { INF, PQ, generate } from './generator';
import { MAX_NODES, decode, encode, presets, randomInput, referenceDistances, validate } from './input';

export type { DijkstraEdge, DijkstraInput } from './generator';

export const pseudocode: Record<string, string[]> = {
  lazy: [
    'dist[*] = ∞; dist[s] = 0; pq = {(0, s)}',
    'while pq not empty:',
    '    (d, u) = pq.popMin()',
    '    if d > dist[u]: continue           // stale entry',
    '    mark u settled',
    '    for (u, v, w) in edges of u, ascending v:',
    '        if dist[u] + w < dist[v]:',
    '            dist[v] = dist[u] + w',
    '            pq.push((dist[v], v))      // old entry stays: lazy deletion',
  ],
};

/** Plain implementation used by tests: distances from s, Infinity when unreachable. */
export function reference(input: DijkstraInput): number[] {
  return referenceDistances(input);
}

const labelToDist = (text: string | null): number => (text === null || text === INF ? Infinity : Number(text));

/** Distances read back from the node labels. */
function result(final: State, input: DijkstraInput): number[] {
  const out: number[] = [];
  for (let v = 0; v < input.n; v++) {
    const gn = final.graph?.nodes.find((x) => x.id === ids.node(v));
    out.push(gn ? labelToDist(gn.text) : Infinity);
  }
  return out;
}

/** What is true in every state of lazy-deletion Dijkstra with non-negative weights:
 *  - a settled node's label is its true shortest distance;
 *  - every finite label is a real path length, so it is ≥ the true distance;
 *  - no unsettled finite label is smaller than any settled label;
 *  - every queue entry's key is ≥ its node's label (entries never beat the label),
 *    and every unsettled node with a finite label has an entry equal to that label,
 *    except the node just popped (between its pop and its settle step). */
export function invariantCheck(state: State, input: DijkstraInput): string | null {
  const g = state.graph;
  if (!g) return null; // before setup
  const ref = referenceDistances(input);
  const label = new Map<string, number>();
  const settledMax = { v: -Infinity };
  for (const gn of g.nodes) label.set(gn.id, labelToDist(gn.text));
  for (let v = 0; v < input.n; v++) {
    const gn = g.nodes.find((x) => x.id === ids.node(v));
    if (!gn) return `node ${v} missing from the graph`;
    const d = labelToDist(gn.text);
    const isSettled = gn.mark === 'settled' || gn.mark === 'stale';
    if (d < (ref[v] as number)) return `dist[${v}] = ${d} is below the true distance ${ref[v]}`;
    if (isSettled) {
      if (d !== ref[v]) return `settled node ${v} has dist ${d}, expected ${ref[v]}`;
      if (d > settledMax.v) settledMax.v = d;
    }
    const vv = state.vars[`dist:${v}`];
    const varDist = typeof vv === 'number' ? vv : vv === INF ? Infinity : NaN;
    if (varDist !== d) return `var dist:${v} = ${String(vv)} disagrees with label ${gn.text}`;
  }
  for (const gn of g.nodes) {
    const d = label.get(gn.id) as number;
    if (gn.mark === null && d !== Infinity && d < settledMax.v) return `unsettled ${gn.id} has dist ${d} below a settled dist ${settledMax.v}`;
  }
  const pq = state.panels[PQ];
  if (pq) {
    for (const it of pq.items) {
      if (it.ref === undefined || it.key === undefined) return `queue entry ${it.id} lacks ref/key`;
      const d = label.get(it.ref);
      if (d === undefined) return `queue entry ${it.id} refers to unknown ${it.ref}`;
      if (it.key < d) return `queue entry ${it.label} is better than dist ${d}`;
    }
    const popped = typeof state.vars.u === 'number' ? ids.node(state.vars.u) : null;
    for (const gn of g.nodes) {
      const d = label.get(gn.id) as number;
      if (gn.mark !== null || d === Infinity || gn.id === popped) continue;
      if (!pq.items.some((it) => it.ref === gn.id && it.key === d)) return `unsettled ${gn.id} has dist ${d} but no matching queue entry`;
    }
  }
  return null;
}

export const dijkstra: AlgorithmModule<DijkstraInput> = {
  meta: {
    id: 'dijkstra',
    title: 'Dijkstra (lazy deletion)',
    family: 'graph',
    renderers: ['graph'],
    panels: ['pq', 'vars'],
    tieBreak: 'The queue pops by (dist, node id); neighbours are relaxed in ascending id; stale entries are skipped when popped.',
    minutes: 5,
    caps: { maxSteps: 200, maxSize: MAX_NODES },
    variants: [{ id: 'lazy', title: 'Binary heap, lazy deletion' }],
  },
  pseudocode,
  invariant: { lazy: { name: 'Settled distances are final', sentence: 'A popped node with a fresh entry is done: nothing can shorten it.' } },
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
  variantOf: () => 'lazy',
};
