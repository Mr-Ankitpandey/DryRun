import type { AlgorithmModule } from '@/algorithms/types';
import { ids } from '@/engine/ids';
import type { State } from '@/engine/state';
import { applyEvent } from '@/engine/reducer';
import { emptyState } from '@/engine/state';
import { code } from './code';
import type { DfsInput, DfsTimes } from './generator';
import { generate, graphEvent, referenceTimes } from './generator';
import { MAX_NODES, decode, encode, presets, randomInput, validate } from './input';

export type { DfsEdge, DfsInput, DfsTimes } from './generator';

export const pseudocode: Record<string, string[]> = {
  recursive: [
    'time = 0',
    'for s in nodes, ascending:',
    '    if s not visited: dfs(s)',
    'dfs(u):',
    '    visited[u] = true; d[u] = ++time',
    '    for v in neighbours(u), ascending:',
    '        if v not visited:',
    '            dfs(v)',
    '    f[u] = ++time',
  ],
};

/** Plain implementation used by tests: discovery and finish time per node. */
export function reference(input: DfsInput): DfsTimes {
  return referenceTimes(input);
}

/** Parses a node label: null (undiscovered), "d/" (open) or "d/f" (finished). */
export function parseLabel(text: string | null): { d: number; f: number | null } | null | 'bad' {
  if (text === null) return null;
  const m = /^(\d+)\/(\d*)$/.exec(text);
  if (!m) return 'bad';
  return { d: Number(m[1]), f: m[2] === '' ? null : Number(m[2]) };
}

/** Times read back from the node labels (0 = never stamped). */
function result(final: State, input: DfsInput): DfsTimes {
  const d: number[] = [];
  const f: number[] = [];
  for (let v = 0; v < input.n; v++) {
    const parsed = parseLabel(final.graph?.nodes.find((x) => x.id === ids.node(v))?.text ?? null);
    d.push(parsed && parsed !== 'bad' ? parsed.d : 0);
    f.push(parsed && parsed !== 'bad' ? (parsed.f ?? 0) : 0);
  }
  return { d, f };
}

/** What holds in every state of DFS:
 *  - every stamped time equals the true one, and stamps only appear in order
 *    (the clock var equals the largest stamp);
 *  - parenthesis property: for any two finished nodes the intervals [d, f]
 *    nest or are disjoint; an open node's interval contains every node stamped
 *    after it;
 *  - visited ⊇ stack: the call stack holds exactly the open nodes (the top may
 *    still wait for its stamp), bottom to top in discovery order; the top is
 *    `active`, the rest of the stack `visited`, finished nodes `settled`,
 *    undiscovered nodes unmarked;
 *  - tree edges are exactly the edges from each call to its caller. */
export function invariantCheck(state: State, input: DfsInput): string | null {
  const g = state.graph;
  if (!g) return 'the graph is missing (it is built into the initial state)';
  if (g.nodes.length !== input.n || g.edges.length !== input.edges.length) return `graph has ${g.nodes.length} nodes and ${g.edges.length} edges, expected ${input.n} and ${input.edges.length}`;
  const ref = referenceTimes(input);
  const times = new Map<number, { d: number; f: number | null }>();
  let maxStamp = 0;
  for (const gn of g.nodes) {
    const v = Number(gn.label);
    const parsed = parseLabel(gn.text);
    if (parsed === 'bad') return `node ${v} has an unreadable label "${gn.text ?? ''}"`;
    if (parsed === null) continue;
    if (parsed.d !== ref.d[v]) return `d[${v}] = ${parsed.d}, but the true discovery time is ${ref.d[v]}`;
    if (parsed.f !== null && parsed.f !== ref.f[v]) return `f[${v}] = ${parsed.f}, but the true finish time is ${ref.f[v]}`;
    times.set(v, parsed);
    maxStamp = Math.max(maxStamp, parsed.f ?? parsed.d);
  }
  const clock = state.vars['time'];
  if (clock !== undefined && clock !== maxStamp) return `time = ${String(clock)}, but the last stamp is ${maxStamp}`;
  if (clock === undefined && maxStamp !== 0) return 'stamps exist before time is set';

  // Parenthesis property.
  const entries = [...times.entries()];
  for (const [v, tv] of entries) {
    for (const [w, tw] of entries) {
      if (v === w) continue;
      if (tv.f !== null && tw.f !== null) {
        const disjoint = tv.f < tw.d || tw.f < tv.d;
        const nested = (tv.d < tw.d && tw.f < tv.f) || (tw.d < tv.d && tv.f < tw.f);
        if (!disjoint && !nested) return `intervals of ${v} [${tv.d}, ${tv.f}] and ${w} [${tw.d}, ${tw.f}] overlap without nesting`;
      }
      // v still open: a node finished before v started cannot end inside v's interval.
      if (tv.f === null && tw.f !== null && tw.d < tv.d && tw.f > tv.d) return `${w} [${tw.d}, ${tw.f}] finished inside open ${v}'s interval without nesting`;
    }
  }

  // Call stack = open nodes.
  const stack = state.frameOrder.map((fid) => state.frames[fid]?.args['u']);
  if (stack.some((u) => typeof u !== 'number')) return 'a frame has no numeric u';
  const stackNodes = stack as number[];
  const open = entries.filter(([, t]) => t.f === null).map(([v]) => v);
  for (const v of open) if (!stackNodes.includes(v)) return `${v} is discovered and unfinished but not on the call stack`;
  for (let k = 0; k < stackNodes.length; k++) {
    const u = stackNodes[k] as number;
    const t = times.get(u);
    const isTop = k === stackNodes.length - 1;
    if (!t && !isTop) return `dfs(${u}) is on the stack below the top without a discovery time`;
    if (t && t.f !== null) return `dfs(${u}) is still on the stack after finishing`;
    if (k > 0 && t) {
      const below = times.get(stackNodes[k - 1] as number);
      if (!below || below.d >= t.d) return 'the call stack is not in discovery order';
    }
  }
  const top = stackNodes[stackNodes.length - 1];
  for (const gn of g.nodes) {
    const v = Number(gn.label);
    const t = times.get(v);
    const want = v === top ? 'active' : stackNodes.includes(v) ? 'visited' : t && t.f !== null ? 'settled' : null;
    if (gn.mark !== want) return `node ${v} is marked ${String(gn.mark)}, expected ${String(want)}`;
  }

  // Tree edges = call → caller.
  const expected = new Set<string>();
  for (const fr of Object.values(state.frames)) {
    if (fr.parent === null) continue;
    const parent = state.frames[fr.parent];
    if (!parent) return `frame ${fr.id} has a missing parent`;
    expected.add(ids.edge(Number(fr.args['u']), Number(parent.args['u'])));
  }
  const tree = g.edges.filter((e) => e.mark === 'tree').map((e) => e.id);
  if (tree.length !== expected.size || tree.some((id) => !expected.has(id))) return `tree edges ${tree.join()} differ from the calls ${[...expected].join()}`;
  if (g.edges.some((e) => e.mark !== null && e.mark !== 'tree')) return 'a non-tree edge mark appears';
  return null;
}

export const dfs: AlgorithmModule<DfsInput> = {
  meta: {
    id: 'dfs',
    title: 'Depth-first search',
    family: 'graph',
    renderers: ['graph'],
    panels: ['callstack', 'vars'],
    tieBreak: 'The outer loop starts at every unvisited node in ascending id; neighbours are tried in ascending id.',
    minutes: 5,
    caps: { maxSteps: 70, maxSize: MAX_NODES },
    variants: [{ id: 'recursive', title: 'Recursive, with discovery and finish times' }],
  },
  pseudocode,
  code,
  invariant: { recursive: { name: 'Nested times', sentence: 'Discovery and finish times nest: a node started after u finishes before u.' } },
  initialState: (input) => applyEvent(emptyState(), graphEvent(input)),
  generate,
  reference,
  result,
  invariantCheck,
  presets,
  randomInput,
  validate,
  encode,
  decode,
  variantOf: () => 'recursive',
};
