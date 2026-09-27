/** Depth-first search, recursive, with discovery and finish times, on an
 *  undirected graph. There is no start node: the outer loop tries every node in
 *  ascending id and starts a new tree at each one still unvisited (a DFS forest).
 *  Neighbours are scanned in ascending id.
 *
 *  The graph is part of the initial state (see `graphEvent`), so the stage
 *  shows it before the first step. Step rhythm:
 *    setup (line 1: time = 0) →
 *    per dfs(u): a call step (line 3 from the outer loop, line 8 from a parent:
 *    `call` frame dfs(u) with args {u}, u `mark active`, the caller's node back to
 *    `visited`, the tree edge marked) → a discovery step (line 5: time ticks,
 *    `label` "d/") → per neighbour v, ascending: already visited → one `read`
 *    step (line 7); unvisited → the child's call step and its whole subtree →
 *    a finish step (line 9: time ticks, `label` "d/f", `mark settled`, `return`,
 *    the parent's node `active` again).
 *    Runs of outer-loop nodes that are already visited are one `read` step
 *    (line 3); a final step (line 2) closes the outer loop.
 *
 *  Marks: `active` = the node of the top frame, `visited` = discovered and still
 *  on the stack below the top, `settled` = finished. In an undirected graph every
 *  non-tree edge is a back edge: a visited neighbour is either the parent (the
 *  tree edge seen from below), an ancestor further up the stack (back edge) or a
 *  finished descendant (the same back edge, already seen from the other end).
 *
 *  Asks (one per step): the call step asks which node dfs visits next (pick;
 *  not on the very first call, nor when one unvisited node is all that is left);
 *  the discovery step asks d[u] (value); a finish step asks f[u] (value), or,
 *  for a node that called nothing, whether dfs(u) returns now (choice, yes);
 *  a read of an ancestor above the parent asks for the call stack (order), unless
 *  the same stack was just asked about;
 *  a read while an unvisited neighbour still waits asks whether dfs(u) returns
 *  now (choice, no). */

import type { Id, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Ask, Distractor } from '@/trace/asks';

export interface DfsEdge {
  a: number;
  b: number;
}

export interface DfsInput {
  n: number;
  edges: DfsEdge[];
}

export interface DfsTimes {
  d: number[];
  f: number[];
}

const RULE_NEXT = 'dfs goes to the current node’s smallest unvisited neighbour; with none left it returns.';
const RULE_ASC = 'Neighbours are tried in ascending id: the smallest unvisited one goes first.';
const RULE_DEPTH = 'Depth first, not breadth first: dfs goes deeper from the newest node before any sibling.';
const RULE_NOT_YET = 'A call returns only when no unvisited neighbour is left; until then it goes deeper.';
const RULE_OUTER = 'The outer loop tries start nodes in ascending id and skips the visited ones.';
const RULE_PRE = '++time ticks before the stamp: the first stamp is 1 and each stamp is one past the last.';
const RULE_TICKS = 'One clock: it ticks when a node is discovered and again when a node finishes.';
const RULE_NOT_DEPTH = 'd is a timestamp from one shared clock, not the depth in the tree.';
const RULE_AFTER_KIDS = 'Every descendant finishes first and each of their ticks counts: f[u] comes after them all.';
const RULE_RETURN = 'dfs(u) returns once every neighbour is checked and none is unvisited.';
const RULE_SKIP = 'A visited neighbour is skipped, not a base case: dfs(u) returns only after its last neighbour.';
const RULE_LEAF = 'When no unvisited neighbour is left, dfs(u) stamps f[u] and returns to its caller.';
const RULE_STACK = 'The call stack lists open calls in call order: the first call at the bottom, the current one on top.';
const RULE_REVERSED = 'Bottom first: the oldest call is at the bottom, the current call is on top.';
const RULE_BY_ID = 'The stack is in call order, not in id order.';

/** Adjacency lists sorted by neighbour id ascending, with the edge ids. */
export function adjacency(input: DfsInput): { v: number; id: Id }[][] {
  const adj: { v: number; id: Id }[][] = Array.from({ length: input.n }, () => []);
  for (const e of input.edges) {
    const id = ids.edge(e.a, e.b);
    (adj[e.a] as { v: number; id: Id }[]).push({ v: e.b, id });
    (adj[e.b] as { v: number; id: Id }[]).push({ v: e.a, id });
  }
  for (const list of adj) list.sort((p, q) => p.v - q.v);
  return adj;
}

const node = (v: number): Id => ids.node(v);
const plural = (k: number, one: string, many: string): string => (k === 1 ? one : many);

interface Open {
  u: number;
  frame: Id;
}

class Ctx {
  readonly n: number;
  readonly adj: { v: number; id: Id }[][];
  readonly visited: boolean[];
  readonly d: (number | null)[];
  readonly f: (number | null)[];
  readonly stack: Open[] = [];
  time = 0;
  frames = 0;
  roots = 0;
  firstCall = true;
  /** The stack last asked about, so an unchanged stack is not asked twice in a row. */
  lastStackAsk = '';

  constructor(input: DfsInput) {
    this.n = input.n;
    this.adj = adjacency(input);
    this.visited = Array.from({ length: input.n }, () => false);
    this.d = Array.from({ length: input.n }, () => null);
    this.f = Array.from({ length: input.n }, () => null);
  }

  nbrs(u: number): { v: number; id: Id }[] {
    return this.adj[u] as { v: number; id: Id }[];
  }

  smallestUnvisited(u: number): number | null {
    const hit = this.nbrs(u).find((e) => !this.visited[e.v]);
    return hit ? hit.v : null;
  }
}

/** The graph, built into the initial state so the stage shows it at step 0. */
export function graphEvent(input: DfsInput): VizEvent {
  return {
    t: 'graph',
    nodes: Array.from({ length: input.n }, (_, i) => ({ id: node(i), label: String(i) })),
    edges: input.edges.map((e) => ({ id: ids.edge(e.a, e.b), a: node(e.a), b: node(e.b) })),
  };
}

export function* generate(input: DfsInput): Iterable<Step> {
  const ctx = new Ctx(input);
  yield {
    line: 1,
    events: [{ t: 'var', name: 'time', value: 0 }],
    note: 'time = 0: nothing is discovered yet, and the outer loop starts at node 0.',
    phase: 'setup',
  };

  let skipped: number[] = [];
  for (let s = 0; s < input.n; s++) {
    if (ctx.visited[s]) {
      skipped.push(s);
      continue;
    }
    if (skipped.length > 0) yield skipStep(skipped);
    skipped = [];
    ctx.roots++;
    yield* dfs(ctx, s);
  }
  if (skipped.length > 0) yield skipStep(skipped);
  yield {
    line: 2,
    events: [],
    note: `Every node is finished: ${ctx.roots} DFS ${plural(ctx.roots, 'tree', 'trees')}, and the clock ends at ${ctx.time}.`,
    phase: 'done',
  };
}

function skipStep(skipped: number[]): Step {
  return {
    line: 3,
    events: skipped.map((s): VizEvent => ({ t: 'read', ref: { id: node(s) } })),
    note: `${skipped.join(', ')} ${plural(skipped.length, 'is', 'are')} already visited: the outer loop skips ${plural(skipped.length, 'it', 'them')}.`,
    phase: 'outer',
  };
}

function* dfs(ctx: Ctx, u: number): Iterable<Step> {
  const caller = ctx.stack[ctx.stack.length - 1] ?? null;
  const frame = ids.frame(ctx.frames++);

  // ---- call
  const callEvents: VizEvent[] = [];
  if (caller) {
    callEvents.push({ t: 'mark', ref: { id: node(caller.u) }, as: 'visited' });
    callEvents.push({ t: 'edge.mark', id: ids.edge(caller.u, u), as: 'tree' });
  }
  callEvents.push({ t: 'call', id: frame, label: `dfs(${u})`, args: { u }, parent: caller ? caller.frame : null });
  callEvents.push({ t: 'mark', ref: { id: node(u) }, as: 'active' });
  const call: Step = {
    line: caller ? 8 : 3,
    events: callEvents,
    note: caller
      ? `${u} is unvisited: dfs(${caller.u}) calls dfs(${u}) along the tree edge ${caller.u}-${u}.`
      : ctx.firstCall
        ? `0 is not visited: the outer loop starts the first tree with dfs(0).`
        : `${u} is not visited: the outer loop starts a new tree with dfs(${u}).`,
    phase: 'call',
  };
  // The very first start is always 0, and a last unvisited node leaves nothing to choose.
  if (!ctx.firstCall && (caller || ctx.visited.filter((seen) => !seen).length > 1)) call.ask = nextAsk(ctx, u);
  ctx.firstCall = false;
  yield call;
  ctx.stack.push({ u, frame });

  // ---- discover
  ctx.visited[u] = true;
  ctx.time++;
  const du = ctx.time;
  ctx.d[u] = du;
  yield {
    line: 5,
    events: [
      { t: 'var', name: 'time', value: du },
      { t: 'label', id: node(u), text: `${du}/` },
    ],
    note: `dfs(${u}) marks ${u} visited, and the clock ticks: d[${u}] = ${du}.`,
    phase: 'discover',
    ask: discoverAsk(ctx, u, du, caller ? caller.u : null),
  };

  // ---- scan neighbours
  let children = 0;
  const list = ctx.nbrs(u);
  for (let k = 0; k < list.length; k++) {
    const v = (list[k] as { v: number; id: Id }).v;
    if (ctx.visited[v]) {
      yield readStep(ctx, u, v, list.slice(k + 1).some((e) => !ctx.visited[e.v]));
      continue;
    }
    children++;
    yield* dfs(ctx, v);
  }

  // ---- finish
  ctx.stack.pop();
  ctx.time++;
  const fu = ctx.time;
  ctx.f[u] = fu;
  const events: VizEvent[] = [
    { t: 'var', name: 'time', value: fu },
    { t: 'label', id: node(u), text: `${du}/${fu}` },
    { t: 'mark', ref: { id: node(u) }, as: 'settled' },
    { t: 'return', id: frame },
  ];
  if (caller) events.push({ t: 'mark', ref: { id: node(caller.u) }, as: 'active' });
  const ask: Ask =
    children === 0
      ? {
          kind: 'choice',
          level: 'full',
          prompt: `Does dfs(${u}) return now?`,
          options: ['yes', 'no'],
          answer: 'yes',
          rule: RULE_RETURN,
          distractors: [{ answer: 'no', kind: 'base-case', rule: RULE_LEAF }],
        }
      : finishAsk(u, du, fu);
  yield {
    line: 9,
    events,
    note: `No unvisited neighbour is left: f[${u}] = ${fu}, and dfs(${u}) returns${caller ? ` to dfs(${caller.u})` : ''}.`,
    phase: 'finish',
    ask,
  };
}

function readStep(ctx: Ctx, u: number, v: number, moreToDo: boolean): Step {
  const stackNodes = ctx.stack.map((o) => o.u);
  const parent = stackNodes.length >= 2 ? (stackNodes[stackNodes.length - 2] as number) : null;
  const onStack = stackNodes.includes(v);
  const step: Step = {
    line: 7,
    events: [{ t: 'read', ref: { id: node(v) } }],
    note:
      v === parent
        ? `${v} is ${u}'s parent: ${u}-${v} is the tree edge dfs came along, so skip it.`
        : onStack
          ? `${v} is on the stack: ${u}-${v} is a back edge to an ancestor, so skip it.`
          : `${v} is already finished (a descendant of ${u}): skip it.`,
    phase: 'scan',
  };
  const key = stackNodes.join();
  if (onStack && v !== parent && key !== ctx.lastStackAsk) {
    ctx.lastStackAsk = key;
    step.ask = stackAsk(u, v, stackNodes);
  } else if (moreToDo) {
    step.ask = {
      kind: 'choice',
      level: 'full',
      prompt: `dfs(${u}) meets ${v}, already visited. Does dfs(${u}) return now?`,
      options: ['yes', 'no'],
      answer: 'no',
      rule: RULE_RETURN,
      distractors: [{ answer: 'yes', kind: 'base-case', rule: RULE_SKIP }],
    };
  }
  return step;
}

/** Pick: which node becomes the newly visited one. Candidates are every node
 *  except the one whose call is running, so the clickable set gives nothing away. */
function nextAsk(ctx: Ctx, answerNode: number): Ask {
  const top = ctx.stack[ctx.stack.length - 1] ?? null;
  const candidates: Id[] = [];
  for (let v = 0; v < ctx.n; v++) if (!top || v !== top.u) candidates.push(node(v));
  const answer = node(answerNode);
  const distractors: Distractor<Id>[] = [];
  const add = (v: number | null, kind: Distractor<Id>['kind'], rule: string) => {
    if (v === null) return;
    const id = node(v);
    if (id === answer || distractors.some((d) => d.answer === id)) return;
    distractors.push({ answer: id, kind, rule });
  };
  if (top) {
    const unvisited = ctx.nbrs(top.u).filter((e) => !ctx.visited[e.v]);
    add(unvisited.length > 0 ? (unvisited[unvisited.length - 1] as { v: number }).v : null, 'order', RULE_ASC);
    // Breadth-first instinct: the next unvisited neighbour of the nearest ancestor that has one.
    for (let k = ctx.stack.length - 2; k >= 0; k--) {
      const w = ctx.smallestUnvisited((ctx.stack[k] as Open).u);
      if (w !== null) {
        add(w, 'order', RULE_DEPTH);
        break;
      }
    }
    // Returning too early: back to the caller's node, or for a root to the next outer-loop start.
    if (ctx.stack.length >= 2) add((ctx.stack[ctx.stack.length - 2] as Open).u, 'base-case', RULE_NOT_YET);
    else add(ctx.visited.indexOf(false), 'base-case', RULE_NOT_YET);
    return {
      kind: 'pick',
      level: 'guided',
      prompt: `dfs(${top.u}) is running. Which node does dfs visit next?`,
      answer,
      candidates,
      rule: RULE_NEXT,
      distractors,
    };
  }
  const unvisited: number[] = [];
  for (let v = 0; v < ctx.n; v++) if (!ctx.visited[v]) unvisited.push(v);
  add(unvisited.length > 0 ? (unvisited[unvisited.length - 1] as number) : null, 'order', RULE_OUTER);
  return {
    kind: 'pick',
    level: 'guided',
    prompt: 'The call stack is empty. Which node does dfs visit next?',
    answer,
    candidates,
    rule: RULE_OUTER,
    distractors,
  };
}

function discoverAsk(ctx: Ctx, u: number, du: number, parent: number | null): Ask {
  const distractors: Distractor<number>[] = [];
  const add = (x: number, rule: string) => {
    if (x === du || distractors.some((d) => d.answer === x)) return;
    distractors.push({ answer: x, kind: 'boundary', rule });
  };
  add(du - 1, RULE_PRE);
  add(ctx.visited.filter(Boolean).length, RULE_TICKS);
  if (parent !== null) add((ctx.d[parent] as number) + 1, RULE_NOT_DEPTH);
  return { kind: 'value', level: 'guided', prompt: `What is d[${u}], the discovery time of ${u}?`, answer: du, rule: RULE_PRE, distractors };
}

function finishAsk(u: number, du: number, fu: number): Ask {
  const distractors: Distractor<number>[] = [{ answer: fu - 1, kind: 'boundary', rule: RULE_PRE }];
  if (du + 1 !== fu && du + 1 !== fu - 1) distractors.push({ answer: du + 1, kind: 'boundary', rule: RULE_AFTER_KIDS });
  return { kind: 'value', level: 'full', prompt: `dfs(${u}) finishes. What is f[${u}]?`, answer: fu, rule: RULE_AFTER_KIDS, distractors };
}

function stackAsk(u: number, v: number, stackNodes: number[]): Ask {
  const answer = stackNodes.map(node);
  const pool = stackNodes
    .slice()
    .sort((p, q) => p - q)
    .map(node);
  const distractors: Distractor<Id[]>[] = [];
  const add = (seq: Id[], rule: string) => {
    const key = seq.join();
    if (key === answer.join() || distractors.some((d) => d.answer.join() === key)) return;
    distractors.push({ answer: seq, kind: 'order', rule });
  };
  add(answer.slice().reverse(), RULE_REVERSED);
  add(pool.slice(), RULE_BY_ID);
  return {
    kind: 'order',
    level: 'full',
    prompt: `${u} meets ${v}, which is on the stack. Call stack from bottom to top?`,
    answer,
    pool,
    rule: RULE_STACK,
    distractors,
  };
}

/** Plain recursive DFS used by tests and the invariant: discovery and finish
 *  times with the same tie-breaks as the generator. */
export function referenceTimes(input: DfsInput): DfsTimes {
  const adj: number[][] = Array.from({ length: input.n }, () => []);
  for (const e of input.edges) {
    (adj[e.a] as number[]).push(e.b);
    (adj[e.b] as number[]).push(e.a);
  }
  for (const list of adj) list.sort((p, q) => p - q);
  const d = Array.from({ length: input.n }, () => 0);
  const f = Array.from({ length: input.n }, () => 0);
  const seen = Array.from({ length: input.n }, () => false);
  let time = 0;
  const visit = (u: number): void => {
    seen[u] = true;
    d[u] = ++time;
    for (const v of adj[u] as number[]) if (!seen[v]) visit(v);
    f[u] = ++time;
  };
  for (let s = 0; s < input.n; s++) if (!seen[s]) visit(s);
  return { d, f };
}
