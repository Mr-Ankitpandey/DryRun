/** Input codec, validation, presets and constrained random inputs for Dijkstra.
 *  URL form: g=0-1:4,0-2:1&n=5&s=0 (undirected edges a-b:w). */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import type { DijkstraEdge, DijkstraInput } from './generator';

export const MAX_NODES = 10;
export const MAX_EDGES = 18;
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 9;
export const NEGATIVE_WEIGHT_ERROR = 'Dijkstra assumes non-negative edges: with a negative edge a settled node could still be improved.';

export const presets: Preset<DijkstraInput>[] = [
  {
    id: 'stale-entry',
    title: 'A stale entry pops',
    input: { n: 4, edges: [{ a: 0, b: 1, w: 4 }, { a: 0, b: 2, w: 1 }, { a: 1, b: 2, w: 2 }, { a: 1, b: 3, w: 1 }, { a: 2, b: 3, w: 5 }], s: 0 },
    why: 'Node 1 is pushed at 4, improved to 3 via 2, and the (4, 1) entry pops stale.',
  },
  {
    id: 'unreachable',
    title: 'Unreachable nodes stay at ∞',
    input: { n: 5, edges: [{ a: 0, b: 1, w: 2 }, { a: 1, b: 2, w: 3 }, { a: 3, b: 4, w: 1 }], s: 0 },
    why: 'Nodes 3 and 4 are never pushed; the queue empties with them at ∞.',
  },
  {
    id: 'equal-weights',
    title: 'Equal weights, ties by id',
    input: { n: 6, edges: [{ a: 0, b: 1, w: 1 }, { a: 0, b: 2, w: 1 }, { a: 1, b: 3, w: 1 }, { a: 2, b: 3, w: 1 }, { a: 3, b: 4, w: 1 }, { a: 2, b: 5, w: 1 }], s: 0 },
    why: 'Several entries share a dist: the smaller id pops first, and equal paths do not relax.',
  },
  {
    id: 'two-paths',
    title: 'Two paths to the same node',
    input: { n: 4, edges: [{ a: 0, b: 1, w: 2 }, { a: 1, b: 3, w: 2 }, { a: 0, b: 2, w: 1 }, { a: 2, b: 3, w: 5 }], s: 0 },
    why: 'The short first hop is not the short path: 3 is reached at 6, then improved to 4.',
  },
  {
    id: 'line',
    title: 'A path graph',
    input: { n: 5, edges: [{ a: 0, b: 1, w: 3 }, { a: 1, b: 2, w: 1 }, { a: 2, b: 3, w: 4 }, { a: 3, b: 4, w: 2 }], s: 0 },
    why: 'One entry at a time: distances accumulate along the line.',
  },
];

export function validate(raw: Record<string, string>): ValidationResult<DijkstraInput> {
  const ns = (raw.n ?? '').trim();
  if (!/^\d+$/.test(ns)) return { ok: false, error: `Enter the number of nodes n (1–${MAX_NODES}).` };
  const n = Number(ns);
  if (n < 1 || n > MAX_NODES) return { ok: false, error: `n must be between 1 and ${MAX_NODES}.` };
  const ss = (raw.s ?? '0').trim();
  if (!/^\d+$/.test(ss)) return { ok: false, error: 'Enter the source node s.' };
  const s = Number(ss);
  if (s >= n) return { ok: false, error: `The source must be a node id between 0 and ${n - 1}.` };
  const g = (raw.g ?? '').trim();
  const edges: DijkstraEdge[] = [];
  const seen = new Set<string>();
  if (g !== '') {
    for (const part of g.split(',')) {
      const m = /^\s*(\d+)-(\d+):(-?\d+)\s*$/.exec(part);
      if (!m) return { ok: false, error: `Edges look like a-b:w, separated by commas (got "${part.trim()}").` };
      const a = Number(m[1]);
      const b = Number(m[2]);
      const w = Number(m[3]);
      if (a >= n || b >= n) return { ok: false, error: `Edge ${a}-${b} uses a node outside 0–${n - 1}.` };
      if (a === b) return { ok: false, error: `Edge ${a}-${b} is a self-loop; it can never shorten a path.` };
      if (w < MIN_WEIGHT) return { ok: false, error: NEGATIVE_WEIGHT_ERROR };
      if (w > MAX_WEIGHT) return { ok: false, error: `Weights are ${MIN_WEIGHT}–${MAX_WEIGHT} (edge ${a}-${b} has ${w}).` };
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) return { ok: false, error: `Edge ${a}-${b} is listed twice.` };
      seen.add(key);
      edges.push({ a, b, w });
    }
  }
  if (edges.length > MAX_EDGES) return { ok: false, error: `At most ${MAX_EDGES} edges.` };
  return { ok: true, input: { n, edges, s } };
}

export function encode(input: DijkstraInput): Record<string, string> {
  return { g: input.edges.map((e) => `${e.a}-${e.b}:${e.w}`).join(','), n: String(input.n), s: String(input.s) };
}

export function decode(params: Record<string, string>): DijkstraInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Plain Dijkstra used by tests and by the random generator's target checks. */
export function referenceDistances(input: DijkstraInput): number[] {
  const dist: number[] = Array.from({ length: input.n }, () => Infinity);
  const done: boolean[] = Array.from({ length: input.n }, () => false);
  dist[input.s] = 0;
  for (;;) {
    let u = -1;
    for (let v = 0; v < input.n; v++) {
      if (!done[v] && (dist[v] as number) !== Infinity && (u === -1 || (dist[v] as number) < (dist[u] as number))) u = v;
    }
    if (u === -1) break;
    done[u] = true;
    for (const e of input.edges) {
      if (e.a !== u && e.b !== u) continue;
      const v = e.a === u ? e.b : e.a;
      if ((dist[u] as number) + e.w < (dist[v] as number)) dist[v] = (dist[u] as number) + e.w;
    }
  }
  return dist;
}

/** Whether lazy-deletion Dijkstra pops at least one stale entry on this input:
 *  some node's distance improves after it has already been pushed. */
export function hasStalePop(input: DijkstraInput): boolean {
  const dist: number[] = Array.from({ length: input.n }, () => Infinity);
  const done: boolean[] = Array.from({ length: input.n }, () => false);
  dist[input.s] = 0;
  for (;;) {
    let u = -1;
    for (let v = 0; v < input.n; v++) {
      if (!done[v] && (dist[v] as number) !== Infinity && (u === -1 || (dist[v] as number) < (dist[u] as number))) u = v;
    }
    if (u === -1) return false;
    done[u] = true;
    for (const e of input.edges) {
      if (e.a !== u && e.b !== u) continue;
      const v = e.a === u ? e.b : e.a;
      const old = dist[v] as number;
      if ((dist[u] as number) + e.w < old) {
        if (old !== Infinity) return true; // the earlier entry (old, v) will pop stale
        dist[v] = (dist[u] as number) + e.w;
      }
    }
  }
}

/** Targets: 'stale' (at least one stale pop) | 'unreachable' | 'connected'. */
export function randomInput(rng: Rng, target?: string): DijkstraInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = rng.int(4, MAX_NODES);
    const maxEdges = Math.min(MAX_EDGES, (n * (n - 1)) / 2);
    const m = rng.int(Math.min(n - 1, maxEdges), maxEdges);
    const pairs: [number, number][] = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
    const edges: DijkstraEdge[] = rng
      .shuffle(pairs)
      .slice(0, m)
      .map(([a, b]) => ({ a, b, w: rng.int(MIN_WEIGHT, MAX_WEIGHT) }));
    const s = rng.int(0, n - 1);
    const input: DijkstraInput = { n, edges, s };
    const dist = referenceDistances(input);
    const unreachable = dist.some((d) => d === Infinity);
    if (target === 'stale' && !hasStalePop(input)) continue;
    if (target === 'unreachable' && !unreachable) continue;
    if (target === 'connected' && unreachable) continue;
    return input;
  }
  const id = target === 'unreachable' ? 'unreachable' : target === 'stale' ? 'stale-entry' : 'two-paths';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<DijkstraInput>);
  return structuredClone(fallback.input);
}
