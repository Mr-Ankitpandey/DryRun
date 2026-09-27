/** Input codec, validation, presets and constrained random inputs for DFS.
 *  URL form: g=0-1,0-2&n=5 (undirected, unweighted edges a-b). There is no start
 *  node: the outer loop tries every node in ascending id. */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import type { DfsEdge, DfsInput } from './generator';
import { referenceTimes } from './generator';

export const MAX_NODES = 10;
export const MAX_EDGES = 16;

const E = (a: number, b: number): DfsEdge => ({ a, b });

export const presets: Preset<DfsInput>[] = [
  { id: 'tree', title: 'A tree', input: { n: 7, edges: [E(0, 1), E(0, 2), E(1, 3), E(1, 4), E(2, 5), E(2, 6)] }, why: 'No cycles: every visited neighbour is the parent, and 1’s whole subtree finishes before 2 starts.' },
  { id: 'cycle', title: 'A cycle', input: { n: 5, edges: [E(0, 1), E(1, 2), E(2, 3), E(3, 4), E(0, 4)] }, why: 'dfs runs all the way round; 4 meets 0 on the stack: one back edge.' },
  { id: 'disconnected', title: 'Three components', input: { n: 6, edges: [E(0, 1), E(0, 2), E(1, 2), E(3, 4)] }, why: 'The outer loop starts new trees at 3 and at 5: the result is a forest.' },
  { id: 'line', title: 'A path graph', input: { n: 5, edges: [E(0, 1), E(1, 2), E(2, 3), E(3, 4)] }, why: 'The stack grows to five calls, then every call returns in reverse order.' },
  { id: 'complete-4', title: 'Complete graph on 4 nodes', input: { n: 4, edges: [E(0, 1), E(0, 2), E(0, 3), E(1, 2), E(1, 3), E(2, 3)] }, why: 'dfs dives 0, 1, 2, 3 in one line; every other edge is a back edge.' },
  { id: 'star', title: 'A star around 2', input: { n: 6, edges: [E(0, 2), E(1, 2), E(2, 3), E(2, 4), E(2, 5)] }, why: 'Each leaf returns at once: the stack stays shallow while 2 waits for all of them.' },
];

export function validate(raw: Record<string, string>): ValidationResult<DfsInput> {
  const ns = (raw.n ?? '').trim();
  if (!/^\d+$/.test(ns)) return { ok: false, error: `Enter the number of nodes n as a whole number from 1 to ${MAX_NODES}.` };
  const n = Number(ns);
  if (n < 1 || n > MAX_NODES) return { ok: false, error: `n must be between 1 and ${MAX_NODES} (got ${n}).` };
  const g = (raw.g ?? '').trim();
  const edges: DfsEdge[] = [];
  const seen = new Set<string>();
  if (g !== '') {
    for (const part of g.split(',')) {
      const p = part.trim();
      if (/^\d+-\d+:/.test(p)) return { ok: false, error: `DFS edges have no weights: write ${p.slice(0, p.indexOf(':'))}, not ${p}.` };
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
  return { ok: true, input: { n, edges } };
}

export function encode(input: DfsInput): Record<string, string> {
  return { g: input.edges.map((e) => `${e.a}-${e.b}`).join(','), n: String(input.n) };
}

export function decode(params: Record<string, string>): DfsInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Number of DFS trees (outer-loop starts). */
export function treeCount(input: DfsInput): number {
  const parent = Array.from({ length: input.n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] as number;
    return x;
  };
  for (const e of input.edges) parent[find(e.a)] = find(e.b);
  let roots = 0;
  for (let v = 0; v < input.n; v++) if (find(v) === v) roots++;
  return roots;
}

/** Deepest call stack during the run (= longest root-to-node path in the DFS forest, in nodes). */
export function maxDepth(input: DfsInput): number {
  const { d, f } = referenceTimes(input);
  let best = 0;
  for (let v = 0; v < input.n; v++) {
    let depth = 0;
    for (let w = 0; w < input.n; w++) if ((d[w] as number) <= (d[v] as number) && (f[v] as number) <= (f[w] as number)) depth++;
    best = Math.max(best, depth);
  }
  return best;
}

/** Whether some edge is a back edge to an ancestor above the parent (a cycle). */
export function hasBackEdge(input: DfsInput): boolean {
  return input.edges.length > input.n - treeCount(input);
}

/** Targets: 'forest' (2+ trees) | 'connected' (one tree) | 'deep' (stack of 5+ calls) | 'back-edge' (a cycle). */
export function randomInput(rng: Rng, target?: string): DfsInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = rng.int(4, MAX_NODES);
    const maxEdges = Math.min(MAX_EDGES, (n * (n - 1)) / 2);
    const m = rng.int(Math.max(1, n - 3), Math.min(maxEdges, n + 4));
    const pairs: [number, number][] = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
    const edges = rng
      .shuffle(pairs)
      .slice(0, m)
      .map(([a, b]) => E(a, b));
    const input: DfsInput = { n, edges };
    if (target === 'forest' && treeCount(input) < 2) continue;
    if (target === 'connected' && treeCount(input) !== 1) continue;
    if (target === 'deep' && maxDepth(input) < 5) continue;
    if (target === 'back-edge' && !hasBackEdge(input)) continue;
    return input;
  }
  const id = target === 'forest' ? 'disconnected' : target === 'deep' ? 'line' : target === 'back-edge' ? 'cycle' : 'tree';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<DfsInput>);
  return structuredClone(fallback.input);
}
