/** Input codec, validation, presets and constrained random inputs for the
 *  topological sort. URL form: n=4&g=0>1,0>2,1>3 (arcs a>b: a comes before b).
 *  Only directed acyclic graphs are accepted: the validator names a cycle. */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import type { TopoArc, TopoInput } from './generator';
import { outArcs } from './generator';

export const MAX_NODES = 10;
export const MAX_ARCS = 16;

const E = (a: number, b: number): TopoArc => ({ a, b });

export const presets: Preset<TopoInput>[] = [
  { id: 'diamond', title: 'A diamond', input: { n: 4, arcs: [E(0, 1), E(0, 2), E(1, 3), E(2, 3)] }, why: '3 needs both 1 and 2 first: its in-degree drops twice before it joins the queue.' },
  { id: 'chain', title: 'A chain', input: { n: 5, arcs: [E(0, 1), E(1, 2), E(2, 3), E(3, 4)] }, why: 'One node in the queue at a time: there is exactly one valid order.' },
  { id: 'two-sources', title: 'Two sources', input: { n: 6, arcs: [E(0, 2), E(1, 2), E(2, 3), E(1, 4), E(4, 5), E(3, 5)] }, why: '0 and 1 both start with in-degree 0 and wait in the queue together.' },
  { id: 'wide', title: 'A wide fan-out', input: { n: 7, arcs: [E(0, 1), E(0, 2), E(0, 3), E(1, 4), E(2, 4), E(3, 5), E(4, 6), E(5, 6)] }, why: 'Removing the arcs out of 0 frees three nodes at once: the queue fills up.' },
  { id: 'ids-in-order', title: 'Ids already in order', input: { n: 5, arcs: [E(0, 1), E(1, 2), E(0, 3), E(3, 4), E(2, 4)] }, why: 'Every arc goes from a smaller id to a larger one, yet the queue outputs 0, 1, 3, 2, 4.' },
  { id: 'reverse-ids', title: 'Ids against the order', input: { n: 4, arcs: [E(3, 2), E(2, 1), E(1, 0)] }, why: 'The largest id must come first: the order follows the arcs, not the ids.' },
  { id: 'single', title: 'One node', input: { n: 1, arcs: [] }, why: 'No arcs: the only node is a source and the whole order.' },
];

/** A cycle in the arcs as a node list that starts and ends on the same node, or null. */
export function findCycle(n: number, arcs: readonly TopoArc[]): number[] | null {
  const out: number[][] = Array.from({ length: n }, () => []);
  for (const e of arcs) (out[e.a] as number[]).push(e.b);
  for (const list of out) list.sort((p, q) => p - q);
  const color = Array.from({ length: n }, () => 0); // 0 new, 1 on the path, 2 done
  const path: number[] = [];
  const visit = (u: number): number[] | null => {
    color[u] = 1;
    path.push(u);
    for (const v of out[u] as number[]) {
      if (color[v] === 1) return [...path.slice(path.indexOf(v)), v];
      if (color[v] === 0) {
        const c = visit(v);
        if (c) return c;
      }
    }
    path.pop();
    color[u] = 2;
    return null;
  };
  for (let s = 0; s < n; s++) {
    if (color[s] !== 0) continue;
    const c = visit(s);
    if (c) return c;
  }
  return null;
}

export function validate(raw: Record<string, string>): ValidationResult<TopoInput> {
  const ns = (raw.n ?? '').trim();
  if (!/^\d+$/.test(ns)) return { ok: false, error: `Enter the number of nodes n as a whole number from 1 to ${MAX_NODES}.` };
  const n = Number(ns);
  if (n < 1 || n > MAX_NODES) return { ok: false, error: `n must be between 1 and ${MAX_NODES} (got ${n}).` };
  const g = (raw.g ?? '').trim();
  const arcs: TopoArc[] = [];
  const seen = new Set<string>();
  if (g !== '') {
    for (const part of g.split(',')) {
      const p = part.trim();
      const m = /^(\d+)>(\d+)$/.exec(p);
      if (!m) return { ok: false, error: `Arcs look like a>b (a comes before b), separated by commas (got "${p}").` };
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a >= n || b >= n) return { ok: false, error: `Arc ${a}>${b} uses a node outside 0–${n - 1}.` };
      if (a === b) return { ok: false, error: `Arc ${a}>${b} is a self-loop: a node cannot come before itself.` };
      if (seen.has(`${a}>${b}`)) return { ok: false, error: `Arc ${a}>${b} is listed twice: keep one copy.` };
      seen.add(`${a}>${b}`);
      arcs.push({ a, b });
    }
  }
  if (arcs.length > MAX_ARCS) return { ok: false, error: `Use at most ${MAX_ARCS} arcs (got ${arcs.length}).` };
  const cycle = findCycle(n, arcs);
  if (cycle) return { ok: false, error: `These arcs form a cycle, ${cycle.join(' → ')}, so no order exists: remove one of them.` };
  return { ok: true, input: { n, arcs } };
}

export function encode(input: TopoInput): Record<string, string> {
  return { n: String(input.n), g: input.arcs.map((e) => `${e.a}>${e.b}`).join(',') };
}

export function decode(params: Record<string, string>): TopoInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Plain Kahn with a FIFO queue, sources and out-arcs in ascending id. */
export function referenceOrder(input: TopoInput): number[] {
  const { out, indeg } = outArcs(input);
  const q: number[] = [];
  for (let v = 0; v < input.n; v++) if (indeg[v] === 0) q.push(v);
  const order: number[] = [];
  while (q.length > 0) {
    const u = q.shift() as number;
    order.push(u);
    for (const v of out[u] as number[]) {
      indeg[v] = (indeg[v] as number) - 1;
      if (indeg[v] === 0) q.push(v);
    }
  }
  return order;
}

/** Largest number of nodes waiting in the queue at once. */
export function maxQueue(input: TopoInput): number {
  const { out, indeg } = outArcs(input);
  const q: number[] = [];
  for (let v = 0; v < input.n; v++) if (indeg[v] === 0) q.push(v);
  let max = q.length;
  while (q.length > 0) {
    const u = q.shift() as number;
    for (const v of out[u] as number[]) {
      indeg[v] = (indeg[v] as number) - 1;
      if (indeg[v] === 0) q.push(v);
    }
    max = Math.max(max, q.length);
  }
  return max;
}

export const hasMultiParent = (input: TopoInput): boolean => outArcs(input).indeg.some((d) => d >= 2);

/** Targets: 'wide' (3+ nodes wait in the queue at once), 'multi-parent' (some
 *  node has in-degree 2 or more, so it waits after an arc is removed). */
export function randomInput(rng: Rng, target?: string): TopoInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = rng.int(4, MAX_NODES);
    // Arcs only go forward in a random permutation: the graph is acyclic.
    const perm = rng.shuffle(Array.from({ length: n }, (_, i) => i));
    const pairs: [number, number][] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([perm[i] as number, perm[j] as number]);
    const m = rng.int(Math.min(n - 1, pairs.length), Math.min(MAX_ARCS, pairs.length, 2 * n));
    const arcs = rng
      .shuffle(pairs)
      .slice(0, m)
      .map(([a, b]) => E(a, b));
    const input: TopoInput = { n, arcs };
    if (target === 'wide' && maxQueue(input) < 3) continue;
    if (target === 'multi-parent' && !hasMultiParent(input)) continue;
    return input;
  }
  const id = target === 'wide' ? 'wide' : 'diamond';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<TopoInput>);
  return structuredClone(fallback.input);
}
