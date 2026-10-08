import type { AlgorithmModule } from '@/algorithms/types';
import { ids } from '@/engine/ids';
import { applyEvent } from '@/engine/reducer';
import type { State } from '@/engine/state';
import { emptyState } from '@/engine/state';
import { code } from './code';
import type { TopoInput } from './generator';
import { ORDER, QUEUE, generate, outArcs, structure } from './generator';
import { MAX_NODES, decode, encode, presets, randomInput, referenceOrder, validate } from './input';

export type { TopoArc, TopoInput } from './generator';

export const pseudocode: Record<string, string[]> = {
  kahn: [
    'for each node v: indeg[v] = number of arcs into v',
    'queue = nodes with indeg 0, in ascending id',
    'while queue not empty:',
    '    u = dequeue(); append u to order',
    '    for each arc u → v, in ascending v:',
    '        indeg[v] = indeg[v] - 1',
    '        if indeg[v] == 0: enqueue(v)',
    'return order          // all n nodes: the graph has no cycle',
  ],
};

/** Plain implementation used by tests: the output order. */
export function reference(input: TopoInput): number[] {
  return referenceOrder(input);
}

/** The output order read back from the 'order' panel. */
function result(final: State): number[] {
  return (final.panels[ORDER]?.items ?? []).map((it) => Number(String(it.ref).slice(2)));
}

/** What holds in every state:
 *  - the output is a prefix of the reference order, every output node settled;
 *  - a removed arc (`rejected`) leaves an output node, and only output nodes'
 *    arcs are removed, in full once the node's turn is over;
 *  - a node's label, once set, is the number of its incoming arcs not yet removed;
 *  - every queued node has in-degree 0, is `frontier`, is queued once, and is
 *    not output; once the queue is filled, a node with in-degree 0 that is not
 *    output is queued, except the one node whose arc was just removed (its
 *    check is the next step). */
export function invariantCheck(state: State, input: TopoInput): string | null {
  const g = state.graph;
  if (!g) return 'no graph';
  const order = result(state);
  const want = referenceOrder(input);
  if (order.some((v, k) => want[k] !== v)) return `output ${order.join()} is not a prefix of ${want.join()}`;
  const output = new Set(order);
  const remaining = Array.from({ length: input.n }, () => 0);
  for (const e of g.edges) {
    const a = Number(e.a.slice(2));
    const b = Number(e.b.slice(2));
    if (e.mark === 'rejected') {
      if (!output.has(a)) return `arc ${a} → ${b} removed before ${a} was output`;
    } else {
      remaining[b] = (remaining[b] as number) + 1;
    }
  }
  const queued = (state.panels[QUEUE]?.items ?? []).map((it) => Number(String(it.ref).slice(2)));
  if (new Set(queued).size !== queued.length) return 'a node is queued twice';
  let pending = 0;
  for (const gn of g.nodes) {
    const v = Number(gn.label);
    if (gn.text !== null && Number(gn.text) !== remaining[v]) return `in-degree label of ${v} is ${gn.text}, but ${remaining[v]} arcs into it remain`;
    if (output.has(v) && gn.mark !== 'settled') return `output node ${v} is not settled`;
    if (queued.includes(v)) {
      if (output.has(v)) return `${v} is both queued and output`;
      if (remaining[v] !== 0) return `${v} is queued with in-degree ${remaining[v]}`;
      if (gn.mark !== 'frontier') return `queued ${v} is not marked frontier`;
    } else if (!output.has(v) && remaining[v] === 0 && gn.text !== null) {
      pending++;
    }
  }
  const started = order.length > 0 || queued.length > 0;
  if (started && pending > 1) return `${pending} nodes have in-degree 0 but are neither queued nor output`;
  // Arcs of an output node are removed in full before the next node is output.
  const { out } = outArcs(input);
  for (const u of order.slice(0, -1)) {
    for (const v of out[u] as number[]) {
      if (g.edges.find((e) => e.id === ids.arc(u, v))?.mark !== 'rejected') return `arc ${u} → ${v} kept after ${u}'s turn`;
    }
  }
  return null;
}

export const topoSort: AlgorithmModule<TopoInput> = {
  meta: {
    id: 'topo-sort',
    title: 'Topological sort (Kahn)',
    family: 'graph',
    renderers: ['graph'],
    panels: ['queue', 'vars'],
    tieBreak: 'The queue is first in, first out: sources start in ascending id, and arcs out of a node are removed in ascending target id.',
    minutes: 5,
    caps: { maxSteps: 60, maxSize: MAX_NODES },
    variants: [{ id: 'kahn', title: 'Kahn, FIFO queue' }],
    fieldLabels: { g: 'Arcs (a>b: a comes before b)' },
  },
  pseudocode,
  code,
  invariant: { kahn: { name: 'Ready means in-degree 0', sentence: 'A node is output only when every arc into it is gone: all its predecessors are already in the order.' } },
  initialState: (input) => structure(input).reduce(applyEvent, emptyState()),
  generate,
  reference,
  result,
  invariantCheck,
  presets,
  randomInput,
  validate,
  encode,
  decode,
  variantOf: () => 'kahn',
};
