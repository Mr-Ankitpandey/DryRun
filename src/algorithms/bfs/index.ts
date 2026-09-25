import type { AlgorithmModule } from '@/algorithms/types';
import { ids } from '@/engine/ids';
import type { State } from '@/engine/state';
import { emptyState } from '@/engine/state';
import type { BfsInput } from './generator';
import { QUEUE, generate } from './generator';
import { MAX_NODES, decode, encode, presets, randomInput, referenceDistances, validate } from './input';

export type { BfsEdge, BfsInput } from './generator';

export const pseudocode: Record<string, string[]> = {
  queue: [
    'dist[s] = 0; queue = [s]; mark s visited',
    'while queue not empty:',
    '    u = dequeue()',
    '    for v in neighbours(u) in ascending id:',
    '        if v not visited:',
    '            mark v visited; dist[v] = dist[u] + 1',
    '            enqueue(v)',
  ],
};

/** Plain implementation used by tests: dist per node, null when unreachable. */
export function reference(input: BfsInput): (number | null)[] {
  return referenceDistances(input);
}

/** Distances read back from the node labels (null = never reached). */
function result(final: State, input: BfsInput): (number | null)[] {
  const out: (number | null)[] = [];
  for (let v = 0; v < input.n; v++) {
    const text = final.graph?.nodes.find((x) => x.id === ids.node(v))?.text ?? null;
    out.push(text === null ? null : Number(text));
  }
  return out;
}

/** What holds in every state of BFS:
 *  - a node's dist label, once written, is its true BFS distance (labels never change);
 *  - marked nodes are labelled; unlabelled nodes are unmarked;
 *  - the queue holds exactly the `frontier` nodes, each once, dists non-decreasing
 *    front to back and spanning at most one layer (d or d + 1);
 *  - no settled node is farther than a queued one;
 *  - tree edges join labelled nodes one layer apart, one per labelled node but s. */
export function invariantCheck(state: State, input: BfsInput): string | null {
  const g = state.graph;
  if (!g) return null; // before setup
  const ref = referenceDistances(input);
  const dist = new Map<string, number | null>();
  for (const gn of g.nodes) {
    const d = gn.text === null ? null : Number(gn.text);
    dist.set(gn.id, d);
    const v = Number(gn.label);
    if (d !== null && d !== ref[v]) return `dist[${v}] = ${d}, but the true BFS distance is ${String(ref[v])}`;
    if (d === null && gn.mark !== null) return `node ${v} is marked ${gn.mark} without a dist`;
    if (d !== null && gn.mark === null) return `node ${v} has a dist but is not marked visited`;
  }
  const queue = state.panels[QUEUE];
  if (!queue) return 'queue panel missing';
  const queued = queue.items.map((it) => it.ref ?? '');
  if (new Set(queued).size !== queued.length) return 'a node is in the queue twice';
  const frontier = g.nodes.filter((x) => x.mark === 'frontier').map((x) => x.id);
  if (frontier.length !== queued.length || frontier.some((id) => !queued.includes(id))) return `frontier ${frontier.join()} differs from the queue ${queued.join()}`;
  const qd = queued.map((id) => dist.get(id) as number);
  for (let k = 1; k < qd.length; k++) if ((qd[k] as number) < (qd[k - 1] as number)) return `queue dists decrease: ${qd.join()}`;
  if (qd.length > 0 && (qd[qd.length - 1] as number) - (qd[0] as number) > 1) return `queue spans more than one layer: ${qd.join()}`;
  const minQueued = qd.length > 0 ? (qd[0] as number) : Infinity;
  for (const gn of g.nodes) {
    if (gn.mark === 'settled' && (dist.get(gn.id) as number) > minQueued) return `settled ${gn.id} is farther than queued nodes`;
  }
  const tree = g.edges.filter((e) => e.mark === 'tree');
  for (const e of tree) {
    const da = dist.get(e.a);
    const db = dist.get(e.b);
    if (da === null || db === null || da === undefined || db === undefined || Math.abs(da - db) !== 1) return `tree edge ${e.id} does not join adjacent layers`;
  }
  const labelled = [...dist.values()].filter((d) => d !== null).length;
  if (tree.length !== Math.max(0, labelled - 1)) return `${tree.length} tree edges for ${labelled} reached nodes`;
  return null;
}

export const bfs: AlgorithmModule<BfsInput> = {
  meta: {
    id: 'bfs',
    title: 'Breadth-first search',
    family: 'graph',
    renderers: ['graph'],
    panels: ['queue', 'vars'],
    tieBreak: 'Neighbours are scanned and enqueued in ascending node id; the queue is first in, first out.',
    minutes: 4,
    caps: { maxSteps: 120, maxSize: MAX_NODES },
    variants: [{ id: 'queue', title: 'Queue, ascending neighbours' }],
  },
  pseudocode,
  invariant: { queue: { name: 'Layers in order', sentence: 'Everything in the queue is at distance d or d + 1; layers come out in order.' } },
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
  variantOf: () => 'queue',
};
