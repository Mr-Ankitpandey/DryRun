/** Dijkstra-like fixture on 5 nodes with a priority queue. A shorter path to
 *  node 3 is found after an entry for it is already queued, so the old entry
 *  becomes stale: it is skipped (struck through) and then popped without work. */

import type { Step } from '@/engine/events';
import { ids } from '@/engine/ids';
import { emptyState } from '@/engine/state';
import type { Fixture } from './types';

const n = ids.node;
const g = ids.edge;
const q = ids.item;

const steps: Step[] = [
  {
    line: 1,
    events: [
      {
        t: 'graph',
        nodes: [0, 1, 2, 3, 4].map((i) => ({ id: n(i), label: String(i) })),
        edges: [
          { id: g(0, 1), a: n(0), b: n(1), w: 4 },
          { id: g(0, 2), a: n(0), b: n(2), w: 1 },
          { id: g(1, 2), a: n(1), b: n(2), w: 2 },
          { id: g(1, 3), a: n(1), b: n(3), w: 1 },
          { id: g(2, 3), a: n(2), b: n(3), w: 5 },
          { id: g(3, 4), a: n(3), b: n(4), w: 3 },
        ],
      },
      { t: 'panel', panel: 'pq', kind: 'pq' },
      { t: 'label', id: n(0), text: '0' },
      { t: 'push', panel: 'pq', item: { id: q(1), label: '0', key: 0, tie: 0, ref: n(0) } },
      { t: 'mark', ref: { id: n(0) }, as: 'frontier' },
    ],
    note: 'dist[0] = 0; every other distance is ∞. Push (0, node 0).',
    phase: 'setup',
  },
  { line: 2, events: [{ t: 'pop', panel: 'pq', itemId: q(1) }, { t: 'mark', ref: { id: n(0) }, as: 'settled' }], note: 'Pop the smallest entry: node 0 at distance 0 is settled.', phase: 'relax' },
  {
    line: 3,
    events: [
      { t: 'read', ref: { id: n(0) } },
      { t: 'compare', a: { id: n(0) }, b: { id: n(1) }, result: '<' },
      { t: 'label', id: n(1), text: '4' },
      { t: 'edge.mark', id: g(0, 1), as: 'relaxed' },
      { t: 'push', panel: 'pq', item: { id: q(2), label: '1', key: 4, tie: 1, ref: n(1) } },
      { t: 'mark', ref: { id: n(1) }, as: 'frontier' },
    ],
    note: 'Relax 0→1: 0 + 4 < ∞, so dist[1] = 4. Push (4, node 1).',
    phase: 'relax',
  },
  {
    line: 3,
    events: [
      { t: 'compare', a: { id: n(0) }, b: { id: n(2) }, result: '<' },
      { t: 'label', id: n(2), text: '1' },
      { t: 'edge.mark', id: g(0, 2), as: 'relaxed' },
      { t: 'push', panel: 'pq', item: { id: q(3), label: '2', key: 1, tie: 2, ref: n(2) } },
      { t: 'mark', ref: { id: n(2) }, as: 'frontier' },
    ],
    note: 'Relax 0→2: 0 + 1 < ∞, so dist[2] = 1. Push (1, node 2).',
    phase: 'relax',
  },
  { line: 2, events: [{ t: 'pop', panel: 'pq', itemId: q(3) }, { t: 'mark', ref: { id: n(2) }, as: 'settled' }], note: 'Pop (1, node 2): the smallest key. Node 2 is settled.', phase: 'relax' },
  {
    line: 3,
    events: [
      { t: 'compare', a: { id: n(2) }, b: { id: n(1) }, result: '<' },
      { t: 'label', id: n(1), text: '3' },
      { t: 'edge.mark', id: g(1, 2), as: 'relaxed' },
      { t: 'edge.mark', id: g(0, 1), as: 'rejected' },
      { t: 'push', panel: 'pq', item: { id: q(4), label: '1', key: 3, tie: 1, ref: n(1) } },
    ],
    note: 'Relax 2→1: 1 + 2 = 3 < 4, so dist[1] = 3. Push (3, node 1); (4, node 1) is now stale.',
    phase: 'relax',
  },
  {
    line: 3,
    events: [
      { t: 'compare', a: { id: n(2) }, b: { id: n(3) }, result: '<' },
      { t: 'label', id: n(3), text: '6' },
      { t: 'edge.mark', id: g(2, 3), as: 'relaxed' },
      { t: 'push', panel: 'pq', item: { id: q(5), label: '3', key: 6, tie: 3, ref: n(3) } },
      { t: 'mark', ref: { id: n(3) }, as: 'frontier' },
    ],
    note: 'Relax 2→3: 1 + 5 = 6 < ∞, so dist[3] = 6. Push (6, node 3).',
    phase: 'relax',
  },
  { line: 2, events: [{ t: 'pop', panel: 'pq', itemId: q(4) }, { t: 'mark', ref: { id: n(1) }, as: 'settled' }], note: 'Pop (3, node 1). Node 1 is settled at 3.', phase: 'relax' },
  {
    line: 3,
    events: [
      { t: 'compare', a: { id: n(1) }, b: { id: n(3) }, result: '<' },
      { t: 'label', id: n(3), text: '4' },
      { t: 'edge.mark', id: g(1, 3), as: 'relaxed' },
      { t: 'edge.mark', id: g(2, 3), as: 'rejected' },
      { t: 'push', panel: 'pq', item: { id: q(6), label: '3', key: 4, tie: 3, ref: n(3) } },
    ],
    note: 'Relax 1→3: 3 + 1 = 4 < 6, so dist[3] = 4. Push (4, node 3); (6, node 3) is now stale.',
    phase: 'relax',
  },
  { line: 4, events: [{ t: 'pop', panel: 'pq', itemId: q(2) }, { t: 'skip', ref: { id: q(2) }, reason: 'stale: node 1 already settled at 3' }], note: 'Pop (4, node 1): node 1 is already settled, so this entry is stale and skipped.', phase: 'relax' },
  { line: 2, events: [{ t: 'pop', panel: 'pq', itemId: q(6) }, { t: 'mark', ref: { id: n(3) }, as: 'settled' }], note: 'Pop (4, node 3). Node 3 is settled at 4.', phase: 'relax' },
  {
    line: 3,
    events: [
      { t: 'compare', a: { id: n(3) }, b: { id: n(4) }, result: '<' },
      { t: 'label', id: n(4), text: '7' },
      { t: 'edge.mark', id: g(3, 4), as: 'relaxed' },
      { t: 'push', panel: 'pq', item: { id: q(7), label: '4', key: 7, tie: 4, ref: n(4) } },
      { t: 'mark', ref: { id: n(4) }, as: 'frontier' },
    ],
    note: 'Relax 3→4: 4 + 3 = 7 < ∞, so dist[4] = 7. Push (7, node 4).',
    phase: 'relax',
  },
  { line: 4, events: [{ t: 'skip', ref: { id: q(5) }, reason: 'stale: node 3 already settled at 4' }], note: 'Next up is (6, node 3), but node 3 is settled at 4: the entry is stale.', phase: 'relax' },
  { line: 4, events: [{ t: 'pop', panel: 'pq', itemId: q(5) }], note: 'The stale entry is popped and discarded without relaxing anything.', phase: 'relax' },
  { line: 2, events: [{ t: 'pop', panel: 'pq', itemId: q(7) }, { t: 'mark', ref: { id: n(4) }, as: 'settled' }], note: 'Pop (7, node 4). Node 4 is settled; the queue is empty, done.', phase: 'done' },
];

export const graphFixture: Fixture = {
  id: 'graph',
  title: 'Dijkstra with a stale PQ entry',
  pseudocode: ['dist[s] = 0; push (0, s)', 'pop (d, u) with the smallest d', 'for each edge u→v: if d + w < dist[v]: dist[v] = d + w; push (dist[v], v)', 'if d > dist[u]: skip (stale entry)'],
  initial: emptyState(),
  steps,
};
