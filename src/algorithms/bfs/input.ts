/** Input codec, validation, presets and constrained random inputs for BFS.
 *  URL form: g=0-1,0-2&n=5&s=0 (undirected, unweighted edges a-b). */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import type { BfsEdge, BfsInput } from './generator';

export const MAX_NODES = 12;
export const MAX_EDGES = 20;

const E = (a: number, b: number): BfsEdge => ({ a, b });

export const presets: Preset<BfsInput>[] = [
  { id: 'tree-like', title: 'Tree-like graph', input: { n: 7, edges: [E(0, 1), E(0, 2), E(1, 3), E(1, 4), E(2, 5), E(2, 6)], s: 0 }, why: 'No cycles: every neighbour is new, and the layers come out one after another.' },
  { id: 'cycle', title: 'A cycle', input: { n: 6, edges: [E(0, 1), E(1, 2), E(2, 3), E(3, 4), E(4, 5), E(0, 5)], s: 0 }, why: 'Two waves go round and meet at 3; the second path finds it already visited.' },
  { id: 'disconnected', title: 'Two components', input: { n: 6, edges: [E(0, 1), E(0, 2), E(1, 2), E(3, 4), E(4, 5)], s: 0 }, why: 'Nodes 3, 4 and 5 are never reached: the queue empties first.' },
  { id: 'complete-4', title: 'Complete graph on 4 nodes', input: { n: 4, edges: [E(0, 1), E(0, 2), E(0, 3), E(1, 2), E(1, 3), E(2, 3)], s: 0 }, why: 'Everything is at distance 1; the rest of the run is skipping visited nodes.' },
  { id: 'line', title: 'A path graph', input: { n: 5, edges: [E(0, 1), E(1, 2), E(2, 3), E(3, 4)], s: 0 }, why: 'One node in the queue at a time: each layer is a single node.' },
];

export function validate(raw: Record<string, string>): ValidationResult<BfsInput> {
  const ns = (raw.n ?? '').trim();
  if (!/^\d+$/.test(ns)) return { ok: false, error: `Enter the number of nodes n as a whole number from 1 to ${MAX_NODES}.` };
  const n = Number(ns);
  if (n < 1 || n > MAX_NODES) return { ok: false, error: `n must be between 1 and ${MAX_NODES} (got ${n}).` };
  const ss = (raw.s ?? '0').trim();
  if (!/^\d+$/.test(ss)) return { ok: false, error: `Enter the start node s as a whole number from 0 to ${n - 1}.` };
  const s = Number(ss);
  if (s >= n) return { ok: false, error: `The start node must be between 0 and ${n - 1} (got ${s}).` };
  const g = (raw.g ?? '').trim();
  const edges: BfsEdge[] = [];
  const seen = new Set<string>();
  if (g !== '') {
    for (const part of g.split(',')) {
      const p = part.trim();
      if (/^\d+-\d+:/.test(p)) return { ok: false, error: `BFS edges have no weights: write ${p.slice(0, p.indexOf(':'))}, not ${p}.` };
      const m = /^(\d+)-(\d+)$/.exec(p);
      if (!m) return { ok: false, error: `Edges look like a-b, separated by commas (got "${p}").` };
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a >= n || b >= n) return { ok: false, error: `Edge ${a}-${b} uses a node outside 0–${n - 1}.` };
      if (a === b) return { ok: false, error: `Edge ${a}-${b} is a self-loop: remove it, a node is never its own neighbour here.` };
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) return { ok: false, error: `Edge ${a}-${b} is listed twice: keep one copy.` };
      seen.add(key);
      edges.push({ a, b });
    }
  }
  if (edges.length > MAX_EDGES) return { ok: false, error: `Use at most ${MAX_EDGES} edges (got ${edges.length}).` };
  return { ok: true, input: { n, edges, s } };
}

export function encode(input: BfsInput): Record<string, string> {
  return { g: input.edges.map((e) => `${e.a}-${e.b}`).join(','), n: String(input.n), s: String(input.s) };
}

export function decode(params: Record<string, string>): BfsInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Plain BFS used by tests: dist per node, null when unreachable. */
export function referenceDistances(input: BfsInput): (number | null)[] {
  const dist: (number | null)[] = Array.from({ length: input.n }, () => null);
  dist[input.s] = 0;
  const q = [input.s];
  while (q.length > 0) {
    const u = q.shift() as number;
    for (const e of input.edges) {
      if (e.a !== u && e.b !== u) continue;
      const v = e.a === u ? e.b : e.a;
      if (dist[v] !== null) continue;
      dist[v] = (dist[u] as number) + 1;
      q.push(v);
    }
  }
  return dist;
}

/** Targets: 'connected' | 'unreachable' | 'wide' (the queue holds 3+ nodes at once). */
export function randomInput(rng: Rng, target?: string): BfsInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = rng.int(5, MAX_NODES);
    const maxEdges = Math.min(MAX_EDGES, (n * (n - 1)) / 2);
    const m = rng.int(Math.min(n - 1, maxEdges), maxEdges);
    const pairs: [number, number][] = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
    const edges = rng
      .shuffle(pairs)
      .slice(0, m)
      .map(([a, b]) => E(a, b));
    const input: BfsInput = { n, edges, s: rng.int(0, n - 1) };
    const dist = referenceDistances(input);
    const unreachable = dist.includes(null);
    if (target === 'connected' && unreachable) continue;
    if (target === 'unreachable' && !unreachable) continue;
    if (target === 'wide' && maxQueue(input) < 3) continue;
    return input;
  }
  const id = target === 'unreachable' ? 'disconnected' : 'tree-like';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<BfsInput>);
  return structuredClone(fallback.input);
}

/** Largest queue length during the run (same scan order as the generator). */
export function maxQueue(input: BfsInput): number {
  const seen = new Set([input.s]);
  const q = [input.s];
  let max = 1;
  while (q.length > 0) {
    const u = q.shift() as number;
    const ns = input.edges
      .filter((e) => e.a === u || e.b === u)
      .map((e) => (e.a === u ? e.b : e.a))
      .sort((p, r) => p - r);
    for (const v of ns) {
      if (seen.has(v)) continue;
      seen.add(v);
      q.push(v);
      max = Math.max(max, q.length);
    }
  }
  return max;
}
