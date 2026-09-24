/** Dijkstra with a binary heap and lazy deletion. See docs/ALGORITHMS.md §7.
 *  The graph is undirected; the PQ orders by (dist, node id); a popped entry whose
 *  key is larger than the node's current distance is stale and skipped.
 *
 *  Step rhythm per iteration: loop check (line 2, carries the pop-order ask) →
 *  pop (line 3, "which node pops next?") → stale skip (line 4, `skip` + `mark
 *  stale` for one step) or settle (line 5, `mark settled`, pred edge → 'tree') →
 *  per edge ascending v: compare (line 7; rejected edges are marked in the same
 *  step) and, when it improves, one update step (line 8: relaxed edge, new
 *  label, push). The stale mark is restored to settled on the following step. */

import type { Id, PanelItem, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Ask, Distractor } from '@/trace/asks';

export interface DijkstraEdge {
  a: number;
  b: number;
  w: number;
}

export interface DijkstraInput {
  n: number;
  edges: DijkstraEdge[];
  s: number;
}

export const PQ = 'pq';
export const INF = '∞';

const RULE_POP = 'The queue pops the smallest (dist, id) entry.';
const RULE_STALE = 'An entry is stale when its dist is larger than the node’s current dist: skip it.';
const RULE_RELAX = 'dist[v] becomes dist[u] + w when that sum is smaller than dist[v].';
const RULE_ORDER = 'Entries pop by (dist, id), smallest first; a node is done at its first pop.';

/** Same order the reducer keeps for 'pq' panels: (key, tie, numeric id). */
export function pqOrder(x: PanelItem, y: PanelItem): number {
  const kx = x.key ?? 0;
  const ky = y.key ?? 0;
  if (kx !== ky) return kx - ky;
  const tx = x.tie ?? 0;
  const ty = y.tie ?? 0;
  if (tx !== ty) return tx - ty;
  return x.id.localeCompare(y.id, 'en', { numeric: true });
}

/** Adjacency sorted by neighbour id ascending. */
export function adjacency(input: DijkstraInput): { v: number; w: number; id: Id }[][] {
  const adj: { v: number; w: number; id: Id }[][] = Array.from({ length: input.n }, () => []);
  for (const e of input.edges) {
    const id = ids.edge(e.a, e.b);
    (adj[e.a] as { v: number; w: number; id: Id }[]).push({ v: e.b, w: e.w, id });
    (adj[e.b] as { v: number; w: number; id: Id }[]).push({ v: e.a, w: e.w, id });
  }
  for (const list of adj) list.sort((p, q) => p.v - q.v);
  return adj;
}

const fmt = (d: number): string => (d === Infinity ? INF : String(d));
const node = (v: number): Id => ids.node(v);
const distVar = (v: number): string => `dist:${v}`;

export function* generate(input: DijkstraInput): Iterable<Step> {
  const { n, s } = input;
  const adj = adjacency(input);
  const dist: number[] = Array.from({ length: n }, () => Infinity);
  dist[s] = 0;
  const settled: boolean[] = Array.from({ length: n }, () => false);
  const pred: (Id | null)[] = Array.from({ length: n }, () => null);
  const pq: PanelItem[] = [];
  let counter = 0;
  const push = (d: number, v: number): PanelItem => {
    const item: PanelItem = { id: ids.item(counter++), key: d, tie: v, ref: node(v), label: `(${d}, ${v})` };
    pq.push(item);
    pq.sort(pqOrder);
    return item;
  };
  /** Distinct nodes in the queue, in the order their first entry pops. */
  const queuedNodes = (): number[] => {
    const seen: number[] = [];
    for (const it of pq) if (!seen.includes(it.tie as number)) seen.push(it.tie as number);
    return seen;
  };

  // ---- line 1: setup
  const setup: VizEvent[] = [
    {
      t: 'graph',
      nodes: Array.from({ length: n }, (_, i) => ({ id: node(i), label: String(i) })),
      edges: input.edges.map((e) => ({ id: ids.edge(e.a, e.b), a: node(e.a), b: node(e.b), w: e.w })),
    },
    { t: 'panel', panel: PQ, kind: 'pq' },
  ];
  for (let v = 0; v < n; v++) {
    setup.push({ t: 'label', id: node(v), text: fmt(dist[v] as number) });
    setup.push({ t: 'var', name: distVar(v), value: v === s ? 0 : INF });
  }
  setup.push({ t: 'push', panel: PQ, item: push(0, s) });
  yield { line: 1, events: setup, note: `dist[${s}] = 0 and every other dist is ∞; the queue starts with (0, ${s}).`, phase: 'setup' };

  let unstale: number | null = null;
  const restore = (events: VizEvent[]): VizEvent[] => {
    if (unstale === null) return events;
    const out: VizEvent[] = [{ t: 'mark', ref: { id: node(unstale) }, as: 'settled' }, ...events];
    unstale = null;
    return out;
  };

  for (;;) {
    // ---- line 2: loop check (+ pop-order ask)
    const queued = queuedNodes();
    const check: Step = {
      line: 2,
      events: restore([]),
      note: pq.length === 0 ? 'The queue is empty: every reachable node is settled.' : `The queue holds ${pq.length} ${pq.length === 1 ? 'entry' : 'entries'}: pop the smallest (dist, id).`,
      phase: 'pop',
    };
    if (queued.length >= 2) check.ask = orderAsk(queued);
    yield check;
    if (pq.length === 0) return;

    // ---- line 3: pop
    const item = pq.shift() as PanelItem;
    const u = item.tie as number;
    const d = item.key as number;
    const popStep: Step = {
      line: 3,
      events: [
        { t: 'pop', panel: PQ, itemId: item.id },
        { t: 'var', name: 'u', value: u },
        { t: 'var', name: 'd', value: d },
      ],
      note: `Pop ${item.label}: it is the smallest (dist, id) in the queue.`,
      phase: 'pop',
    };
    if (queued.length >= 2) popStep.ask = popAsk(pq, item, queued);
    yield popStep;

    const stale = d > (dist[u] as number);
    const staleAsk: Ask = {
      kind: 'choice',
      level: 'guided',
      prompt: `Popped (${d}, ${u}) and dist[${u}] = ${dist[u]}. Is this entry stale?`,
      options: ['yes', 'no'],
      answer: stale ? 'yes' : 'no',
      rule: RULE_STALE,
      distractors: [{ answer: stale ? 'no' : 'yes', kind: 'stale', rule: RULE_STALE }],
    };
    if (stale) {
      // ---- line 4: stale entry
      yield {
        line: 4,
        events: [
          { t: 'skip', ref: { id: node(u) }, reason: `stale: dist already ${dist[u]}` },
          { t: 'mark', ref: { id: node(u) }, as: 'stale' },
        ],
        note: `(${d}, ${u}) is stale: dist[${u}] is already ${dist[u]}, so skip it.`,
        phase: 'pop',
        ask: staleAsk,
      };
      unstale = u;
      continue;
    }

    // ---- line 5: settle
    settled[u] = true;
    const settleEvents: VizEvent[] = [{ t: 'mark', ref: { id: node(u) }, as: 'settled' }];
    const pu = pred[u] ?? null;
    if (pu !== null) settleEvents.push({ t: 'edge.mark', id: pu, as: 'tree' });
    yield {
      line: 5,
      events: settleEvents,
      note: `(${d}, ${u}) is fresh: dist[${u}] = ${d} is final, nothing can shorten it.`,
      phase: 'settle',
      ask: staleAsk,
    };

    // ---- lines 6–9: relax edges of u, ascending v
    for (const e of adj[u] as { v: number; w: number; id: Id }[]) {
      const v = e.v;
      const cand = (dist[u] as number) + e.w;
      const old = dist[v] as number;
      const better = cand < old;
      const result = cand < old ? '<' : cand === old ? '=' : '>';
      const cmp: VizEvent[] = [
        { t: 'read', ref: { id: e.id } },
        { t: 'var', name: 'cand', value: cand },
        { t: 'compare', a: { id: node(u) }, b: { id: node(v) }, result },
      ];
      if (!better && pred[u] !== e.id) cmp.push({ t: 'edge.mark', id: e.id, as: 'rejected' });
      yield {
        line: 7,
        events: cmp,
        note: better
          ? `dist[${u}] + w = ${dist[u]} + ${e.w} = ${cand} < dist[${v}] = ${fmt(old)}: the edge improves ${v}.`
          : settled[v]
            ? `dist[${u}] + w = ${cand} ≥ dist[${v}] = ${old}: ${v} is settled, the edge is rejected.`
            : `dist[${u}] + w = ${cand} ≥ dist[${v}] = ${fmt(old)}: the edge is rejected.`,
        phase: 'relax',
      };
      if (!better) continue;

      // ---- lines 8–9: update dist[v] and push (the old entry stays)
      dist[v] = cand;
      const upd: VizEvent[] = [];
      const oldPred = pred[v] ?? null;
      if (oldPred !== null) upd.push({ t: 'edge.mark', id: oldPred, as: null });
      pred[v] = e.id;
      upd.push({ t: 'edge.mark', id: e.id, as: 'relaxed' });
      upd.push({ t: 'label', id: node(v), text: String(cand) });
      upd.push({ t: 'var', name: distVar(v), value: cand });
      upd.push({ t: 'push', panel: PQ, item: push(cand, v) });
      const distractors: Distractor<number>[] = [];
      if (old !== Infinity) distractors.push({ answer: old, kind: 'comparison', rule: 'dist[u] + w is smaller than the old dist, so dist[v] changes.' });
      if (e.w !== cand) distractors.push({ answer: e.w, kind: 'dependency', rule: 'The new distance is dist[u] + w, not the edge weight alone.' });
      yield {
        line: 8,
        events: upd,
        note: old === Infinity ? `dist[${v}] = ${cand}: push (${cand}, ${v}).` : `dist[${v}] = ${cand}: push (${cand}, ${v}); the old entry (${old}, ${v}) stays and will pop stale.`,
        phase: 'relax',
        ask: {
          kind: 'value',
          level: 'guided',
          prompt: `Relaxing ${u}–${v} (w = ${e.w}) with dist[${u}] = ${dist[u]}. New dist[${v}]?`,
          answer: cand,
          rule: RULE_RELAX,
          distractors,
        },
      };
    }
  }
}

function popAsk(rest: PanelItem[], min: PanelItem, queued: number[]): Ask {
  const answer = node(min.tie as number);
  const candidates = queued.map(node);
  const distractors: Distractor<Id>[] = [];
  const byId = Math.min(...queued);
  if (node(byId) !== answer) distractors.push({ answer: node(byId), kind: 'order', rule: 'The queue pops the smallest dist, not the smallest id.' });
  const all = [min, ...rest];
  const largest = all.reduce((p, q) => (pqOrder(p, q) >= 0 ? p : q));
  const largestNode = node(largest.tie as number);
  if (largestNode !== answer && !distractors.some((d) => d.answer === largestNode)) {
    distractors.push({ answer: largestNode, kind: 'comparison', rule: 'Smaller dist pops first.' });
  }
  const shown = all.map((it) => it.label).join(' ');
  return { kind: 'pick', level: 'guided', prompt: `Queue: ${shown}. Which node pops next?`, answer, candidates, rule: RULE_POP, distractors };
}

function orderAsk(queued: number[]): Ask {
  const answer = queued.map(node);
  const pool = answer.slice();
  const distractors: Distractor<Id[]>[] = [];
  const reversed = answer.slice().reverse();
  distractors.push({ answer: reversed, kind: 'order', rule: 'Smallest dist pops first, not largest.' });
  const byId = queued
    .slice()
    .sort((p, q) => p - q)
    .map(node);
  if (byId.join() !== answer.join()) distractors.push({ answer: byId, kind: 'order', rule: 'The id only breaks ties between equal distances.' });
  return { kind: 'order', level: 'full', prompt: 'Pop order of the queued nodes from here, assuming no more pushes?', answer, pool, rule: RULE_ORDER, distractors };
}
