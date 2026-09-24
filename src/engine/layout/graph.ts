/** Graph layout (docs/ARCHITECTURE.md §4): layered by BFS depth from the
 *  smallest node id (columns), nodes in a column ordered by id, then one
 *  barycenter pass to reduce crossings. Computed once from the first state that
 *  carries a graph (topology is fixed at load). Nodes unreachable from the
 *  start get their own trailing column. */

import type { Id } from '../events';
import type { Run } from '../run';
import type { GraphState } from '../state';
import { PAD } from './constants';

export interface GraphLayout {
  pos: Record<Id, { x: number; y: number }>;
  r: number;
}

export const GRAPH_NODE_R = 20;
export const GRAPH_ROW_H = 76;
export const GRAPH_MIN_H = 3 * GRAPH_ROW_H;

const byId = (a: Id, b: Id) => a.localeCompare(b, 'en', { numeric: true });

export function layoutGraph(run: Run, width: number, top: number): { layout: GraphLayout; height: number } | null {
  const graph = run.states.find((s) => s.graph !== null)?.graph;
  if (!graph) return null;
  return layoutGraphState(graph, width, top);
}

export function layoutGraphState(graph: GraphState, width: number, top: number): { layout: GraphLayout; height: number } | null {
  if (graph.nodes.length === 0) return null;
  const ids = graph.nodes.map((n) => n.id).sort(byId);
  const adj = new Map<Id, Id[]>();
  for (const id of ids) adj.set(id, []);
  for (const e of graph.edges) {
    adj.get(e.a)?.push(e.b);
    adj.get(e.b)?.push(e.a);
  }
  // BFS depth from the smallest id; unreachable nodes go to one extra column.
  const depth = new Map<Id, number>();
  const start = ids[0] as Id;
  depth.set(start, 0);
  const queue: Id[] = [start];
  while (queue.length) {
    const u = queue.shift() as Id;
    const du = depth.get(u) as number;
    for (const v of [...(adj.get(u) ?? [])].sort(byId)) {
      if (!depth.has(v)) {
        depth.set(v, du + 1);
        queue.push(v);
      }
    }
  }
  const reachedMax = Math.max(...[...depth.values()]);
  for (const id of ids) if (!depth.has(id)) depth.set(id, reachedMax + 1);

  const cols: Id[][] = [];
  for (const id of ids) {
    const d = depth.get(id) as number;
    (cols[d] ??= []).push(id);
  }
  // One barycenter pass, left to right: order each column by the mean row
  // index of its neighbours in the previous column (ties keep id order).
  for (let d = 1; d < cols.length; d++) {
    const prev = cols[d - 1] as Id[];
    const rowOf = new Map(prev.map((id, i) => [id, i]));
    const col = cols[d] as Id[];
    const bary = new Map<Id, number>();
    for (const id of col) {
      const rows = (adj.get(id) ?? []).filter((v) => rowOf.has(v)).map((v) => rowOf.get(v) as number);
      bary.set(id, rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : Number.POSITIVE_INFINITY);
    }
    col.sort((a, b) => {
      const ba = bary.get(a) as number;
      const bb = bary.get(b) as number;
      if (ba !== bb) return ba < bb ? -1 : 1;
      return byId(a, b);
    });
  }

  const rowsMax = Math.max(...cols.map((c) => c.length));
  const height = Math.max(GRAPH_MIN_H, rowsMax * GRAPH_ROW_H) + 2 * PAD;
  const colW = cols.length > 1 ? (width - 2 * PAD - 2 * GRAPH_NODE_R) / (cols.length - 1) : 0;
  const pos: Record<Id, { x: number; y: number }> = {};
  cols.forEach((col, d) => {
    const x = cols.length > 1 ? PAD + GRAPH_NODE_R + d * colW : width / 2;
    const gap = (height - 2 * PAD) / (col.length + 1);
    col.forEach((id, i) => {
      pos[id] = { x, y: top + PAD + gap * (i + 1) };
    });
  });
  return { layout: { pos, r: GRAPH_NODE_R }, height };
}
