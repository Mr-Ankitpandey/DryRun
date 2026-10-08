/** Graph layout (docs/ARCHITECTURE.md §4): layered by BFS depth from the
 *  smallest node id (columns), nodes in a column ordered by id, then one
 *  barycenter pass to reduce crossings. Computed once from the first state that
 *  carries a graph (topology is fixed at load). Nodes unreachable from the
 *  start get their own trailing column.
 *
 *  Directed acyclic graphs are layered by the longest path from a source
 *  instead, so every arc points rightwards. An arc whose straight line would
 *  pass through another node (or that has a reverse twin) gets a `bend`: the
 *  perpendicular offset of a quadratic curve's control point, chosen once so
 *  the curve clears every other node. Undirected graphs never bend. */

import type { Id } from '../events';
import type { Run } from '../run';
import type { GraphState } from '../state';
import { PAD } from './constants';

export interface GraphLayout {
  pos: Record<Id, { x: number; y: number }>;
  r: number;
  /** Directed graphs only: control-point offset per arc id (0 / absent = straight). */
  bend?: Record<Id, number>;
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
  const depth = (graph.directed ? longestPathLayers(graph, ids) : null) ?? bfsLayers(adj, ids);

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
  const colW = cols.length > 1 ? (width - 2 * PAD - 2 * GRAPH_NODE_R) / (cols.length - 1) : 0;
  const place = (height: number): Record<Id, { x: number; y: number }> => {
    const pos: Record<Id, { x: number; y: number }> = {};
    cols.forEach((col, d) => {
      const x = cols.length > 1 ? PAD + GRAPH_NODE_R + d * colW : width / 2;
      const gap = (height - 2 * PAD) / (col.length + 1);
      col.forEach((id, i) => {
        pos[id] = { x, y: top + PAD + gap * (i + 1) };
      });
    });
    return pos;
  };
  const base = Math.max(GRAPH_MIN_H, rowsMax * GRAPH_ROW_H) + 2 * PAD;
  if (!graph.directed) return { layout: { pos: place(base), r: GRAPH_NODE_R }, height: base };
  // Directed: when some arc cannot clear every node and label, give the
  // columns more height (up to 5 rows more) so the curves have room. Keep the
  // first placement that clears everything, else the one with the fewest arcs
  // through a node, then the fewest touching a label.
  let best: { layout: GraphLayout; height: number; blocked: number; cramped: number } | null = null;
  for (let extra = 0; extra <= 5; extra++) {
    const height = base + extra * GRAPH_ROW_H;
    const pos = place(height);
    const { bend, blocked, cramped } = arcBends(graph, pos, { left: 4, right: width - 4, top: top + 4, bottom: top + height - 4 });
    if (!best || blocked < best.blocked || (blocked === best.blocked && cramped < best.cramped)) best = { layout: { pos, r: GRAPH_NODE_R, bend }, height, blocked, cramped };
    if (blocked === 0 && cramped === 0) break;
  }
  return best ? { layout: best.layout, height: best.height } : null;
}

/** BFS depth from the smallest id; unreachable nodes go to one extra column. */
function bfsLayers(adj: Map<Id, Id[]>, ids: Id[]): Map<Id, number> {
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
  return depth;
}

/** Column = length of the longest path from a source (Kahn order), or null
 *  when the arcs have a cycle (then the undirected layering is used). */
export function longestPathLayers(graph: GraphState, ids: Id[]): Map<Id, number> | null {
  const indeg = new Map<Id, number>(ids.map((id) => [id, 0]));
  const out = new Map<Id, Id[]>(ids.map((id) => [id, []]));
  for (const e of graph.edges) {
    indeg.set(e.b, (indeg.get(e.b) ?? 0) + 1);
    out.get(e.a)?.push(e.b);
  }
  const depth = new Map<Id, number>(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => indeg.get(id) === 0);
  let seen = 0;
  while (queue.length) {
    const u = queue.shift() as Id;
    seen++;
    for (const v of out.get(u) ?? []) {
      depth.set(v, Math.max(depth.get(v) ?? 0, (depth.get(u) ?? 0) + 1));
      const d = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, d);
      if (d === 0) queue.push(v);
    }
  }
  return seen === ids.length ? depth : null;
}

const BEND_STEPS = [0, ...Array.from({ length: 18 }, (_, k) => 26 + 14 * k)];
/** Clearance between a curve and any other node's centre. */
const CLEAR = GRAPH_NODE_R + 7;
/** The text a node may carry underneath (a distance, an in-degree): kept clear too. */
const LABEL = { dy: GRAPH_NODE_R + 10, halfW: 16, halfH: 8 };

/** Point of the quadratic from a to b whose control point is the midpoint
 *  pushed `h` along the left normal of a → b. */
export function curvePoint(a: { x: number; y: number }, b: { x: number; y: number }, h: number, t: number): { x: number; y: number } {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const cx = (a.x + b.x) / 2 - ((b.y - a.y) / len) * h;
  const cy = (a.y + b.y) / 2 + ((b.x - a.x) / len) * h;
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y };
}

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Smallest bend (either side) whose curve clears every other node, every
 *  node's label and stays inside the graph's box; arcs with a reverse twin
 *  bend at least a little so the two do not overlap. When nothing clears, the
 *  bend with the least overlap wins. */
interface Score {
  circle: number;
  soft: number;
  arc: number;
}

const better = (x: Score, y: Score): boolean => (x.circle !== y.circle ? x.circle < y.circle : x.soft !== y.soft ? x.soft < y.soft : x.arc < y.arc);

/** Arc bends for one placement, and how many arcs still run through a node
 *  (`blocked`) or only touch a label / leave the box (`cramped`). */
export function arcBends(graph: GraphState, pos: Record<Id, { x: number; y: number }>, bounds: Bounds): { bend: Record<Id, number>; blocked: number; cramped: number } {
  const out: Record<Id, number> = {};
  let blocked = 0;
  let cramped = 0;
  const pairs = new Set(graph.edges.map((e) => `${e.a}>${e.b}`));
  const all = graph.nodes.map((n) => ({ id: n.id, p: pos[n.id] })).filter((n): n is { id: Id; p: { x: number; y: number } } => n.p !== undefined);
  /** Sample points of the arcs placed so far, with their bounding boxes. */
  const placed: { a: Id; b: Id; pts: { x: number; y: number }[]; box: Bounds }[] = [];
  const SAMPLES = 36;
  for (const e of graph.edges) {
    const a = pos[e.a];
    const b = pos[e.b];
    if (!a || !b) continue;
    const twin = pairs.has(`${e.b}>${e.a}`);
    const near = placed.filter((q) => q.a !== e.a || q.b !== e.b);
    /** How far a candidate breaks the rules, in priority order: running
     *  through another node's circle; touching a node's label or leaving the
     *  box; running along another arc (it would read as one line). */
    const hits = (h: number, budget: number): Score => {
      let circle = 0;
      let soft = 0;
      const pts: { x: number; y: number }[] = [];
      for (let k = 1; k < SAMPLES; k++) {
        const p = curvePoint(a, b, h, k / SAMPLES);
        // Inside an endpoint's circle the stroke is not drawn.
        if (Math.hypot(p.x - a.x, p.y - a.y) < GRAPH_NODE_R + 2 || Math.hypot(p.x - b.x, p.y - b.y) < GRAPH_NODE_R + 2) continue;
        pts.push(p);
        for (const n of all) {
          if (n.id !== e.a && n.id !== e.b) circle = Math.max(circle, CLEAR - Math.hypot(p.x - n.p.x, p.y - n.p.y));
          const dx = Math.abs(p.x - n.p.x) - LABEL.halfW;
          const dy = Math.abs(p.y - (n.p.y + LABEL.dy)) - LABEL.halfH;
          if (dx < 0 && dy < 0) soft = Math.max(soft, Math.min(-dx, -dy));
        }
        soft = Math.max(soft, bounds.left - p.x, p.x - bounds.right, bounds.top - p.y, p.y - bounds.bottom);
        if (circle > budget) return { circle, soft: Infinity, arc: Infinity };
      }
      // Crossing another arc is fine (a sample or two come close); running
      // along it for a stretch is not: count the close samples per arc.
      let arc = 0;
      for (const q of near) {
        const shared = [q.a, q.b].filter((id) => id === e.a || id === e.b).map((id) => pos[id] as { x: number; y: number });
        let close = 0;
        for (const p of pts) {
          if (p.x < q.box.left - 8 || p.x > q.box.right + 8 || p.y < q.box.top - 8 || p.y > q.box.bottom + 8) continue;
          if (shared.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < GRAPH_NODE_R + 26)) continue;
          if (q.pts.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < 8)) close++;
        }
        arc = Math.max(arc, close - 3);
      }
      return { circle, soft, arc };
    };
    let best: Score & { h: number } = { h: 0, circle: Infinity, soft: Infinity, arc: Infinity };
    search: for (const step of BEND_STEPS) {
      for (const side of step === 0 ? [1] : [1, -1]) {
        const h = twin ? side * Math.max(step, 22) : side * step;
        const w = hits(h, best.circle);
        if (better(w, best)) best = { h, ...w };
        if (w.circle <= 0 && w.soft <= 0 && w.arc <= 0) break search;
      }
    }
    if (best.h !== 0) out[e.id] = best.h;
    if (best.circle > 0) blocked++;
    else if (best.soft > 0) cramped++;
    const pts = Array.from({ length: SAMPLES - 1 }, (_, k) => curvePoint(a, b, best.h, (k + 1) / SAMPLES));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    placed.push({ a: e.a, b: e.b, pts, box: { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) } });
  }
  return { bend: out, blocked, cramped };
}
