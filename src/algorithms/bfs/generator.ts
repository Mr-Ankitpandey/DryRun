/** Breadth-first search on an undirected, unweighted graph. See docs/ALGORITHMS.md §6.
 *  Neighbours are scanned in ascending id. Step rhythm:
 *    setup (line 1: graph, queue panel, dist[s] = 0, s enqueued and `frontier`) →
 *    per iteration: dequeue (line 3: `pop` the front, `mark settled`) →
 *    per neighbour v, ascending: already visited → one `read` step (line 5, the
 *    visible "skipped" beat); new → one discovery step (line 6: `mark frontier`,
 *    `label` dist, tree edge, `push` at the back) →
 *    when the queue is empty: a final step (line 2) naming unreachable nodes.
 *  The loop check on line 2 is folded into the dequeue step.
 *
 *  Asks: the dequeue step asks which node leaves (when ≥ 2 are queued); the last
 *  discovery step of an iteration asks for the queue contents afterwards (when it
 *  holds ≥ 2), the other discovery steps ask for dist[v]. One ask per step. */

import type { Id, PanelItem, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Ask, Distractor } from '@/trace/asks';

export interface BfsEdge {
  a: number;
  b: number;
}

export interface BfsInput {
  n: number;
  edges: BfsEdge[];
  s: number;
}

export const QUEUE = 'queue';

const RULE_DEQUEUE = 'A queue is first in, first out: the node at the front leaves next.';
const RULE_STACK = 'Queue, not stack: the front (oldest) node leaves, not the one added last.';
const RULE_FIFO_ID = 'The queue is first in, first out: the oldest node leaves, whatever its id.';
const RULE_QUEUE = 'New nodes join the back of the queue in ascending id; the front leaves first.';
const RULE_BACK = 'New nodes join the back of the queue, not the front.';
const RULE_ASC = 'Neighbours are scanned in ascending id, so they are enqueued in that order.';
const RULE_REVERSE = 'Front first: the oldest node is at the front, the newest at the back.';
const RULE_DIST = 'A newly discovered node is one edge farther than u: dist[v] = dist[u] + 1.';

/** Adjacency sorted by neighbour id ascending. */
export function adjacency(input: BfsInput): { v: number; id: Id }[][] {
  const adj: { v: number; id: Id }[][] = Array.from({ length: input.n }, () => []);
  for (const e of input.edges) {
    const id = ids.edge(e.a, e.b);
    (adj[e.a] as { v: number; id: Id }[]).push({ v: e.b, id });
    (adj[e.b] as { v: number; id: Id }[]).push({ v: e.a, id });
  }
  for (const list of adj) list.sort((p, q) => p.v - q.v);
  return adj;
}

const node = (v: number): Id => ids.node(v);

export function* generate(input: BfsInput): Iterable<Step> {
  const { n, s } = input;
  const adj = adjacency(input);
  const dist: (number | null)[] = Array.from({ length: n }, () => null);
  const queue: { item: PanelItem; v: number }[] = [];
  let counter = 0;
  const enqueue = (v: number): PanelItem => {
    const item: PanelItem = { id: ids.item(counter++), ref: node(v), label: String(v) };
    queue.push({ item, v });
    return item;
  };

  dist[s] = 0;
  yield {
    line: 1,
    events: [
      {
        t: 'graph',
        nodes: Array.from({ length: n }, (_, i) => ({ id: node(i), label: String(i) })),
        edges: input.edges.map((e) => ({ id: ids.edge(e.a, e.b), a: node(e.a), b: node(e.b) })),
      },
      { t: 'panel', panel: QUEUE, kind: 'queue' },
      { t: 'label', id: node(s), text: '0' },
      { t: 'mark', ref: { id: node(s) }, as: 'frontier' },
      { t: 'push', panel: QUEUE, item: enqueue(s) },
    ],
    note: `dist[${s}] = 0: ${s} is marked visited and is the only node in the queue.`,
    phase: 'setup',
  };

  for (;;) {
    if (queue.length === 0) {
      const unreachable = dist.map((d, v) => (d === null ? v : -1)).filter((v) => v !== -1);
      yield {
        line: 2,
        events: [],
        note:
          unreachable.length === 0
            ? 'The queue is empty: every node is reached and its dist is final.'
            : `The queue is empty: ${unreachable.length === 1 ? 'node' : 'nodes'} ${unreachable.join(', ')} ${unreachable.length === 1 ? 'is' : 'are'} unreachable from ${s}.`,
        phase: 'done',
      };
      return;
    }

    const queuedBefore = queue.map((q) => q.v);
    const front = queue.shift() as { item: PanelItem; v: number };
    const u = front.v;
    const du = dist[u] as number;
    const deq: Step = {
      line: 3,
      events: [
        { t: 'pop', panel: QUEUE, itemId: front.item.id },
        { t: 'mark', ref: { id: node(u) }, as: 'settled' },
        { t: 'var', name: 'u', value: u },
      ],
      note: `Dequeue ${u} from the front: it has waited longest (dist ${du}).`,
      phase: 'dequeue',
    };
    if (queuedBefore.length >= 2) deq.ask = dequeueAsk(queuedBefore);
    yield deq;

    const fresh = (adj[u] as { v: number; id: Id }[]).filter((e) => dist[e.v] === null).map((e) => e.v);
    const oldQueue = queue.map((q) => q.v);
    for (const e of adj[u] as { v: number; id: Id }[]) {
      const v = e.v;
      if (dist[v] !== null) {
        const queued = queue.some((q) => q.v === v);
        yield {
          line: 5,
          events: [{ t: 'read', ref: { id: node(v) } }],
          note: queued ? `${v} is already visited and waiting in the queue: skip it.` : `${v} is already visited: skip it, it is never enqueued twice.`,
          phase: 'scan',
        };
        continue;
      }
      dist[v] = du + 1;
      const events: VizEvent[] = [
        { t: 'mark', ref: { id: node(v) }, as: 'frontier' },
        { t: 'label', id: node(v), text: String(du + 1) },
        { t: 'edge.mark', id: e.id, as: 'tree' },
        { t: 'push', panel: QUEUE, item: enqueue(v) },
      ];
      const last = v === fresh[fresh.length - 1];
      const after = queue.map((q) => q.v);
      const ask: Ask = last && after.length >= 2 ? queueAsk(after, oldQueue, fresh) : distAsk(u, v, du);
      yield {
        line: 6,
        events,
        note: `${v} is new: dist[${v}] = ${du} + 1 = ${du + 1}, and it joins the back of the queue.`,
        phase: 'scan',
        ask,
      };
    }
  }
}

function dequeueAsk(queued: number[]): Ask {
  const answer = node(queued[0] as number);
  const candidates = queued.map(node);
  const distractors: Distractor<Id>[] = [{ answer: node(queued[queued.length - 1] as number), kind: 'order', rule: RULE_STACK }];
  const byId = node(Math.min(...queued));
  if (byId !== answer && !distractors.some((d) => d.answer === byId)) distractors.push({ answer: byId, kind: 'order', rule: RULE_FIFO_ID });
  return { kind: 'pick', level: 'guided', prompt: `Queue, front first: ${queued.join(', ')}. Which node is dequeued next?`, answer, candidates, rule: RULE_DEQUEUE, distractors };
}

function queueAsk(after: number[], old: number[], fresh: number[]): Ask {
  const answer = after.map(node);
  const pool = after
    .slice()
    .sort((p, q) => p - q)
    .map(node);
  const distractors: Distractor<Id[]>[] = [];
  const add = (seq: number[], rule: string) => {
    const ids_ = seq.map(node);
    const key = ids_.join();
    if (key === answer.join() || distractors.some((d) => d.answer.join() === key)) return;
    distractors.push({ answer: ids_, kind: 'order', rule });
  };
  add(after.slice().reverse(), RULE_REVERSE);
  add([...fresh, ...old], RULE_BACK);
  add([...old, ...fresh.slice().reverse()], RULE_ASC);
  return { kind: 'order', level: 'guided', prompt: 'Queue contents after this step, front first?', answer, pool, rule: RULE_QUEUE, distractors };
}

function distAsk(u: number, v: number, du: number): Ask {
  const distractors: Distractor<number>[] = [
    { answer: du, kind: 'boundary', rule: RULE_DIST },
    { answer: du + 2, kind: 'boundary', rule: RULE_DIST },
  ];
  return { kind: 'value', level: 'full', prompt: `${u} (dist ${du}) discovers ${v}. What is dist[${v}]?`, answer: du + 1, rule: RULE_DIST, distractors };
}
