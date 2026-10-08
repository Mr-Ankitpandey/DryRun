/** Topological sort, Kahn's algorithm, on a directed acyclic graph. See
 *  docs/ALGORITHMS.md §12. The queue is first in, first out: the sources start
 *  in it in ascending id, and the arcs out of a node are removed in ascending
 *  target id, so nodes that reach in-degree 0 join the back in that order.
 *  Step rhythm:
 *    in-degrees (line 1: every node labelled with its count) →
 *    sources (line 2: pushed in ascending id, `frontier`) →
 *    per dequeue (line 4: `pop` the front, `mark settled`, appended to `order`) →
 *    per arc u → v, ascending v: remove it (line 6: arc `rejected`, v's label
 *    drops) → check (line 7: in-degree 0 → `push` v; else a `read` beat) →
 *    the end (line 8).
 *  Asks: the dequeue step asks which node is output next (guided); every
 *  removal asks for v's new in-degree (guided); every check asks whether v
 *  can enter the queue (full), except the last enqueue of an iteration that
 *  leaves 2+ nodes queued, which asks for the queue contents (full). */

import type { Id, PanelItem, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Ask, Distractor } from '@/trace/asks';

export interface TopoArc {
  a: number;
  b: number;
}

export interface TopoInput {
  n: number;
  arcs: TopoArc[];
}

export const QUEUE = 'queue';
export const ORDER = 'order';

const RULE_FRONT = 'The queue is first in, first out: the node at the front is output next.';
const RULE_STACK = 'Queue, not stack: the front (oldest) node leaves, not the one added last.';
const RULE_FIFO_ID = 'The queue is first in, first out: the oldest node leaves, whatever its id.';
const RULE_INDEG0 = 'Only a node with in-degree 0 can be output: every arc into it must be gone first.';
const RULE_DROP = 'Removing the arc u → v takes exactly one off the in-degree of v.';
const RULE_JOIN = 'A node joins the queue the moment its in-degree reaches 0, and only then.';
const RULE_WAIT = 'In-degree above 0 means some node must still come first: it waits.';
const RULE_READY = 'In-degree 0 means nothing must come before it any more: it joins the queue.';
const RULE_QUEUE = 'New nodes join the back of the queue in ascending id; the front leaves first.';
const RULE_BACK = 'New nodes join the back of the queue, not the front.';
const RULE_REVERSE = 'Front first: the oldest node is at the front, the newest at the back.';

const node = (v: number): Id => ids.node(v);

/** Out-neighbours sorted ascending, and in-degrees. */
export function outArcs(input: TopoInput): { out: number[][]; indeg: number[] } {
  const out: number[][] = Array.from({ length: input.n }, () => []);
  const indeg = Array.from({ length: input.n }, () => 0);
  for (const e of input.arcs) {
    (out[e.a] as number[]).push(e.b);
    indeg[e.b] = (indeg[e.b] as number) + 1;
  }
  for (const list of out) list.sort((p, q) => p - q);
  return { out, indeg };
}

export function* generate(input: TopoInput): Iterable<Step> {
  const { n } = input;
  const { out, indeg } = outArcs(input);
  const deg = [...indeg];
  const queue: { item: PanelItem; v: number }[] = [];
  const done = new Set<number>();
  let counter = 0;
  const enqueue = (v: number): PanelItem => {
    const item: PanelItem = { id: ids.item(counter++), ref: node(v), label: String(v) };
    queue.push({ item, v });
    return item;
  };

  yield {
    line: 1,
    events: Array.from({ length: n }, (_, v): VizEvent => ({ t: 'label', id: node(v), text: String(indeg[v]) })),
    note: 'Count the arcs into each node: that count is its in-degree.',
    phase: 'setup',
  };

  const sources = deg.map((d, v) => (d === 0 ? v : -1)).filter((v) => v !== -1);
  const pushes: VizEvent[] = [];
  for (const v of sources) pushes.push({ t: 'mark', ref: { id: node(v) }, as: 'frontier' }, { t: 'push', panel: QUEUE, item: enqueue(v) });
  const setup: Step = {
    line: 2,
    events: pushes,
    note: sources.length === 1 ? `Only ${sources[0]} has in-degree 0: it is the one node in the queue.` : `In-degree 0: ${sources.join(', ')}. They join the queue in ascending id.`,
    phase: 'setup',
  };
  if (sources.length >= 2) setup.ask = queueAsk(sources, [], sources, 'Which nodes start in the queue, front first?');
  yield setup;

  while (queue.length > 0) {
    const queued = queue.map((q) => q.v);
    const front = queue.shift() as { item: PanelItem; v: number };
    const u = front.v;
    const left = Array.from({ length: n }, (_, v) => v).filter((v) => !done.has(v));
    done.add(u);
    const deq: Step = {
      line: 4,
      events: [
        { t: 'pop', panel: QUEUE, itemId: front.item.id },
        { t: 'mark', ref: { id: node(u) }, as: 'settled' },
        { t: 'push', panel: ORDER, item: { id: ids.item(1000 + u), ref: node(u), label: String(u) } },
        { t: 'var', name: 'u', value: u },
      ],
      note: `Dequeue ${u} from the front and append it to the order (${done.size} of ${n}).`,
      phase: 'output',
    };
    if (left.length >= 2) deq.ask = dequeueAsk(queued, left, deg);
    yield deq;

    const before = queue.map((q) => q.v);
    const fresh = (out[u] as number[]).filter((v) => deg[v] === 1);
    for (const v of out[u] as number[]) {
      const d = deg[v] as number;
      deg[v] = d - 1;
      yield {
        line: 6,
        events: [
          { t: 'edge.mark', id: ids.arc(u, v), as: 'rejected' },
          { t: 'label', id: node(v), text: String(d - 1) },
        ],
        note: `Remove the arc ${u} → ${v}: the in-degree of ${v} drops from ${d} to ${d - 1}.`,
        phase: 'remove',
        ask: dropAsk(u, v, d),
      };
      if (d - 1 === 0) {
        const last = v === fresh[fresh.length - 1];
        enqueue(v);
        const after = queue.map((q) => q.v);
        const item = (queue[queue.length - 1] as { item: PanelItem }).item;
        yield {
          line: 7,
          events: [
            { t: 'mark', ref: { id: node(v) }, as: 'frontier' },
            { t: 'push', panel: QUEUE, item },
          ],
          note: `${v} has in-degree 0 now: it joins the back of the queue.`,
          phase: 'remove',
          ask: last && after.length >= 2 ? queueAsk(after, before, fresh, 'Queue contents after this step, front first?') : readyAsk(v, true),
        };
      } else {
        yield {
          line: 7,
          events: [{ t: 'read', ref: { id: node(v) } }],
          note: `${v} still has ${d - 1} ${d - 1 === 1 ? 'arc' : 'arcs'} in: it waits.`,
          phase: 'remove',
          ask: readyAsk(v, false),
        };
      }
    }
  }

  yield {
    line: 8,
    events: [],
    note: `The queue is empty and all ${n} ${n === 1 ? 'node is' : 'nodes are'} in the order: no cycle.`,
    phase: 'done',
  };
}

function dequeueAsk(queued: number[], left: number[], deg: readonly number[]): Ask {
  const answer = node(queued[0] as number);
  const candidates = left.map(node);
  const distractors: Distractor<Id>[] = [];
  const add = (id: Id, kind: Distractor<Id>['kind'], rule: string) => {
    if (id === answer || distractors.some((d) => d.answer === id)) return;
    distractors.push({ answer: id, kind, rule });
  };
  add(node(queued[queued.length - 1] as number), 'order', RULE_STACK);
  add(node(Math.min(...queued)), 'order', RULE_FIFO_ID);
  const blocked = left.filter((v) => (deg[v] as number) > 0);
  if (blocked.length > 0) add(node(Math.min(...blocked)), 'comparison', RULE_INDEG0);
  const prompt = queued.length === 1 ? 'Which node is output next?' : `Queue, front first: ${queued.join(', ')}. Which node is output next?`;
  return { kind: 'pick', level: 'guided', prompt, answer, candidates, rule: RULE_FRONT, distractors };
}

function dropAsk(u: number, v: number, d: number): Ask {
  const distractors: Distractor<number>[] = [{ answer: d, kind: 'boundary', rule: RULE_DROP }];
  if (d - 2 >= 0) distractors.push({ answer: d - 2, kind: 'boundary', rule: RULE_DROP });
  return { kind: 'value', level: 'guided', prompt: `In-degree of ${v} after removing the arc ${u} → ${v}?`, answer: d - 1, rule: RULE_DROP, distractors };
}

function readyAsk(v: number, yes: boolean): Ask {
  return {
    kind: 'choice',
    level: 'full',
    prompt: `Can ${v} enter the queue now?`,
    options: ['yes', 'no'],
    answer: yes ? 'yes' : 'no',
    rule: RULE_JOIN,
    distractors: [{ answer: yes ? 'no' : 'yes', kind: 'comparison', rule: yes ? RULE_READY : RULE_WAIT }],
  };
}

function queueAsk(after: number[], old: number[], fresh: number[], prompt: string): Ask {
  const answer = after.map(node);
  const pool = [...after].sort((p, q) => p - q).map(node);
  const distractors: Distractor<Id[]>[] = [];
  const add = (seq: number[], rule: string) => {
    const xs = seq.map(node);
    const key = xs.join();
    if (key === answer.join() || distractors.some((d) => d.answer.join() === key)) return;
    distractors.push({ answer: xs, kind: 'order', rule });
  };
  add([...after].reverse(), RULE_REVERSE);
  add([...fresh, ...old], RULE_BACK);
  return { kind: 'order', level: 'full', prompt, answer, pool, rule: RULE_QUEUE, distractors };
}

/** Graph (directed), empty queue and empty output, applied by `initialState`
 *  so the stage shows the problem at step 0. */
export function structure(input: TopoInput): VizEvent[] {
  return [
    {
      t: 'graph',
      nodes: Array.from({ length: input.n }, (_, i) => ({ id: ids.node(i), label: String(i) })),
      edges: input.arcs.map((e) => ({ id: ids.arc(e.a, e.b), a: ids.node(e.a), b: ids.node(e.b) })),
      directed: true,
    },
    { t: 'panel', panel: QUEUE, kind: 'queue' },
    { t: 'panel', panel: ORDER, kind: 'queue' },
  ];
}
