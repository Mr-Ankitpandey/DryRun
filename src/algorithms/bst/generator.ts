/** BST insert / search / delete generator. See docs/ALGORITHMS.md §5.
 *  The tree is built from `keys` in order as a prelude (phase 'build'), then the
 *  operation walks one path with `mark active`, one step per node. Delete cases
 *  follow docs/ARCHITECTURE.md §1: one child = detach(node) → relink(child,
 *  grandparent, side) → remove(node); root delete is the same with parent null;
 *  two children = walk to the successor, `node.set` the key copy, then delete the
 *  successor by the leaf / one-child path.
 *
 *  Node ids are minted from the key at insertion (`n:<key>`). A two-child delete
 *  copies the successor's key into an existing node, so ids and keys diverge from
 *  then on: the generator keeps its own model and never assumes id = n:key. */

import type { Id, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Ask, Distractor } from '@/trace/asks';

export type BstOp = 'insert' | 'search' | 'delete';

export interface BstInput {
  keys: number[];
  op: BstOp;
  x: number;
}

export type DeleteCase = 'leaf' | 'one child' | 'two children';
export const CASE_OPTIONS: DeleteCase[] = ['leaf', 'one child', 'two children'];

const RULE_PATH = 'Smaller keys go left, larger keys go right.';
const RULE_CASE = 'Count the children: none → remove it; one → the child takes its place; two → copy the in-order successor.';
const RULE_SUCC = 'The in-order successor is the smallest key in the right subtree: right once, then left to the end.';
const RULE_RELINK = "The deleted node's only child is relinked to the deleted node's parent.";

/** Pseudocode line numbers per variant (docs/ALGORITHMS.md §5 numbering). */
const LINES = {
  insert: { head: 1, attach: 2, left: 3, right: 4 },
  delete: { head: 6, miss: 7, left: 8, right: 9, case0: 10, case1: 11, two: 12, succ: 13 },
  search: { head: 6, miss: 7, found: 8, left: 9, right: 10 },
} as const;

// ---------------------------------------------------------------------------
// Plain model mirrored by the generator (the reducer is the source of truth in
// tests; this model only lets the generator know the shape of the tree).

interface Node {
  id: Id;
  key: number;
  parent: Id | null;
  left: Id | null;
  right: Id | null;
}

class Model {
  nodes = new Map<Id, Node>();
  root: Id | null = null;

  get(id: Id): Node {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`bst model: unknown node ${id}`);
    return n;
  }

  /** Walks from the root comparing `x`; returns the compared nodes and where the walk ended. */
  walk(x: number): { path: Node[]; found: Node | null; parent: Node | null; side: 'L' | 'R' | null } {
    const path: Node[] = [];
    let cur = this.root;
    let parent: Node | null = null;
    let side: 'L' | 'R' | null = null;
    while (cur !== null) {
      const n = this.get(cur);
      path.push(n);
      if (x === n.key) return { path, found: n, parent, side };
      parent = n;
      side = x < n.key ? 'L' : 'R';
      cur = side === 'L' ? n.left : n.right;
    }
    return { path, found: null, parent, side };
  }

  add(key: number, parent: Node | null, side: 'L' | 'R' | null): Node {
    const id = ids.node(key);
    if (this.nodes.has(id)) throw new Error(`bst model: duplicate node ${id}`);
    const node: Node = { id, key, parent: parent ? parent.id : null, left: null, right: null };
    this.nodes.set(id, node);
    if (parent === null) this.root = id;
    else if (side === 'L') parent.left = id;
    else parent.right = id;
    return node;
  }

  detach(n: Node): void {
    if (n.parent === null) {
      if (this.root === n.id) this.root = null;
    } else {
      const p = this.get(n.parent);
      if (p.left === n.id) p.left = null;
      else if (p.right === n.id) p.right = null;
    }
    n.parent = null;
  }

  relink(n: Node, parent: Node | null, side: 'L' | 'R' | null): void {
    this.detach(n);
    if (parent === null) {
      this.root = n.id;
    } else {
      if (side === 'L') parent.left = n.id;
      else parent.right = n.id;
      n.parent = parent.id;
    }
  }

  remove(n: Node): void {
    if (n.left !== null || n.right !== null) throw new Error(`bst model: remove ${n.id} with children`);
    this.detach(n);
    this.nodes.delete(n.id);
  }

  subtree(id: Id | null, out: Node[] = []): Node[] {
    if (id === null) return out;
    const n = this.get(id);
    out.push(n);
    this.subtree(n.left, out);
    this.subtree(n.right, out);
    return out;
  }

  min(id: Id): { node: Node; via: Node[] } {
    const via: Node[] = [];
    let n = this.get(id);
    while (n.left !== null) {
      via.push(n);
      n = this.get(n.left);
    }
    return { node: n, via };
  }

  max(id: Id): Node {
    let n = this.get(id);
    while (n.right !== null) n = this.get(n.right);
    return n;
  }

  allIds(): Id[] {
    return [...this.nodes.keys()];
  }
}

// ---------------------------------------------------------------------------

export function* generate(input: BstInput): Iterable<Step> {
  const m = new Model();
  for (const key of input.keys) yield buildStep(m, key);
  yield* operation(m, input);
}

function buildStep(m: Model, key: number): Step {
  const { path, parent, side } = m.walk(key);
  const node = m.add(key, parent, side);
  const hops = path.map((n) => `${key} ${key < n.key ? '<' : '>'} ${n.key} ${key < n.key ? 'left' : 'right'}`);
  const note =
    parent === null ? `Insert ${key}: the tree is empty, so ${key} becomes the root.` : `Insert ${key}: ${hops.join(', ')}; attach as ${side === 'L' ? 'left' : 'right'} child of ${parent.key}.`;
  return {
    line: LINES.insert.attach,
    events: [{ t: 'node.add', id: node.id, key, parent: node.parent, side }],
    note,
    phase: 'build',
  };
}

/** Walks the operation's path from the root, one step per compared node. */
function* walkPath(m: Model, input: BstInput): Generator<Step, ReturnType<Model['walk']>, undefined> {
  const { op, x } = input;
  const res = m.walk(x);
  const opName = op === 'insert' ? 'Insert' : op === 'search' ? 'Search for' : 'Delete';
  const head = op === 'insert' ? LINES.insert.head : LINES.delete.head;
  const rootNode = m.root === null ? null : m.get(m.root);
  yield {
    line: head,
    events: [
      { t: 'var', name: 'op', value: op },
      { t: 'var', name: 'x', value: x },
      { t: 'var', name: 'path', value: '' },
      { t: 'var', name: 'found', value: false },
    ],
    note: rootNode === null ? `${opName} ${x}: the tree is empty, so the walk ends at once.` : `${opName} ${x}: start at the root ${rootNode.key} and compare.`,
    phase: op,
  };

  const seen: number[] = [];
  let prev: Node | null = null;
  for (const n of res.path) {
    seen.push(n.key);
    const result = x === n.key ? '=' : x < n.key ? '<' : '>';
    const events: VizEvent[] = [];
    if (prev) events.push({ t: 'mark', ref: { id: prev.id }, as: 'visited' });
    events.push({ t: 'mark', ref: { id: n.id }, as: 'active' });
    events.push({ t: 'compare', a: { id: n.id }, b: { var: 'x' }, result });
    events.push({ t: 'var', name: 'path', value: seen.join(',') });
    if (result === '=') events.push({ t: 'var', name: 'found', value: true });
    const step: Step = {
      line: lineFor(op, result),
      events,
      note: noteFor(op, x, n.key, result),
      phase: op,
    };
    if (prev) step.ask = nextNodeAsk(prev, n, x);
    yield step;
    prev = n;
  }
  return res;
}

function lineFor(op: BstOp, result: '<' | '=' | '>'): number {
  if (op === 'insert') return result === '<' ? LINES.insert.left : LINES.insert.right;
  if (op === 'search') return result === '=' ? LINES.search.found : result === '<' ? LINES.search.left : LINES.search.right;
  return result === '=' ? LINES.delete.case0 : result === '<' ? LINES.delete.left : LINES.delete.right;
}

function noteFor(op: BstOp, x: number, key: number, result: '<' | '=' | '>'): string {
  if (result === '<') return `${x} < ${key}: smaller keys live on the left, so go left.`;
  if (result === '>') return `${x} > ${key}: larger keys live on the right, so go right.`;
  if (op === 'insert') return `${x} equals ${key}: the key is already here.`;
  if (op === 'search') return `${x} equals ${key}: found.`;
  return `${x} equals ${key}: this is the node to delete.`;
}

function nextNodeAsk(from: Node, to: Node, x: number): Ask {
  const candidates: Id[] = [];
  if (from.left !== null) candidates.push(from.left);
  if (from.right !== null) candidates.push(from.right);
  const other = candidates.find((id) => id !== to.id);
  const distractors: Distractor<Id>[] = [];
  if (other !== undefined) {
    distractors.push({ answer: other, kind: 'subtree', rule: `${x} ${x < from.key ? '<' : '>'} ${from.key}, so the path goes ${x < from.key ? 'left' : 'right'}, not ${x < from.key ? 'right' : 'left'}.` });
  }
  return {
    kind: 'pick',
    level: 'guided',
    prompt: `x = ${x}, at ${from.key}. Which node is next on the path?`,
    answer: to.id,
    candidates,
    rule: RULE_PATH,
    distractors,
  };
}

function* operation(m: Model, input: BstInput): Iterable<Step> {
  const { op, x } = input;
  const res = yield* walkPath(m, input);
  const { found, parent, side } = res;

  if (op === 'search') {
    if (found) {
      yield { line: LINES.search.found, events: [{ t: 'mark', ref: { id: found.id }, as: 'done' }], note: `${x} is in the tree: return the node holding ${x}.`, phase: op };
    } else {
      yield { line: LINES.search.miss, events: [{ t: 'var', name: 'found', value: false }], note: `The ${side === 'L' ? 'left' : side === 'R' ? 'right' : 'root'} slot is empty: ${x} is not in the tree.`, phase: op };
    }
    return;
  }

  if (op === 'insert') {
    if (found) {
      yield { line: LINES.insert.right, events: [{ t: 'mark', ref: { id: found.id }, as: 'done' }], note: `${x} is already in the tree: keys are distinct here, so nothing changes.`, phase: op };
      return;
    }
    const node = m.add(x, parent, side);
    const events: VizEvent[] = [];
    if (parent) events.push({ t: 'mark', ref: { id: parent.id }, as: 'visited' });
    events.push({ t: 'node.add', id: node.id, key: x, parent: node.parent, side });
    events.push({ t: 'mark', ref: { id: node.id }, as: 'done' });
    yield {
      line: LINES.insert.attach,
      events,
      note: parent === null ? `The tree is empty: ${x} becomes the root.` : `The ${side === 'L' ? 'left' : 'right'} slot of ${parent.key} is empty: attach ${x} there.`,
      phase: op,
    };
    return;
  }

  // delete
  if (!found) {
    yield { line: LINES.delete.miss, events: [{ t: 'var', name: 'found', value: false }], note: `The ${side === 'L' ? 'left' : side === 'R' ? 'right' : 'root'} slot is empty: ${x} is not in the tree, nothing changes.`, phase: op };
    return;
  }
  yield* deleteNode(m, found, `${found.key}`, 'delete');
}

/** Deletes `n` (already marked active) by its case. `label` names it in prompts. */
function* deleteNode(m: Model, n: Node, label: string, phase: string, lineOverride?: number): Iterable<Step> {
  const kids = (n.left === null ? 0 : 1) + (n.right === null ? 0 : 1);
  const Label = label.charAt(0).toUpperCase() + label.slice(1);
  const which: DeleteCase = kids === 0 ? 'leaf' : kids === 1 ? 'one child' : 'two children';
  const caseAsk = (): Ask => ({
    kind: 'choice',
    level: 'guided',
    prompt: `Deleting ${label}: which delete case applies?`,
    options: CASE_OPTIONS,
    answer: which,
    rule: RULE_CASE,
    distractors: CASE_OPTIONS.filter((o) => o !== which).map((o) => ({ answer: o, kind: 'base-case', rule: RULE_CASE })),
  });

  if (which === 'leaf') {
    m.remove(n);
    yield {
      line: lineOverride ?? LINES.delete.case0,
      events: [
        { t: 'var', name: 'case', value: which },
        { t: 'node.remove', id: n.id },
        { t: 'var', name: 'copied', value: null },
      ],
      note: `${Label} has no children: remove it and its parent's link becomes empty.`,
      phase,
      ask: caseAsk(),
    };
    return;
  }

  if (which === 'one child') {
    const childId = (n.left ?? n.right) as Id;
    const child = m.get(childId);
    const gp = n.parent === null ? null : m.get(n.parent);
    const gpSide: 'L' | 'R' | null = gp === null ? null : gp.left === n.id ? 'L' : 'R';
    const line = lineOverride ?? (n.left === null ? LINES.delete.case0 : LINES.delete.case1);
    const candidates = m.allIds();
    m.detach(n);
    yield {
      line,
      events: [
        { t: 'var', name: 'case', value: which },
        { t: 'node.detach', id: n.id },
      ],
      note: `${Label} has one child (${child.key}): lift it out so ${child.key} can take its place.`,
      phase,
      ask: caseAsk(),
    };
    m.relink(child, gp, gpSide);
    m.remove(n);
    yield {
      line,
      events: [
        { t: 'node.relink', id: child.id, parent: gp === null ? null : gp.id, side: gpSide },
        { t: 'node.remove', id: n.id },
        { t: 'var', name: 'copied', value: null },
      ],
      note: gp === null ? `${child.key} is relinked as the new root; ${label} is gone.` : `${child.key} is relinked as the ${gpSide === 'L' ? 'left' : 'right'} child of ${gp.key}; ${label} is gone.`,
      phase,
      ask: {
        kind: 'pick',
        level: 'full',
        prompt: `Which node is relinked in place of ${label}?`,
        answer: child.id,
        candidates,
        rule: RULE_RELINK,
        distractors: candidates.filter((id) => id !== child.id).map((id) => ({ answer: id, kind: 'subtree', rule: RULE_RELINK })),
      },
    };
    return;
  }

  // two children
  yield {
    line: LINES.delete.two,
    events: [{ t: 'var', name: 'case', value: which }],
    note: `${Label} has two children: copy the in-order successor's key here, then delete that successor.`,
    phase,
    ask: caseAsk(),
  };

  const right = m.get(n.right as Id);
  const { node: succ, via } = m.min(right.id);
  const subtree = m.subtree(right.id).map((s) => s.id);
  const rightMax = m.max(right.id);
  const distractors: Distractor<Id>[] = [];
  if (right.id !== succ.id) distractors.push({ answer: right.id, kind: 'subtree', rule: 'The right child is the successor only when it has no left child.' });
  if (rightMax.id !== succ.id && rightMax.id !== right.id) distractors.push({ answer: rightMax.id, kind: 'subtree', rule: 'The successor is the minimum of the right subtree, not its maximum.' });
  const events: VizEvent[] = via.map((v) => ({ t: 'read', ref: { id: v.id } }));
  events.push({ t: 'mark', ref: { id: succ.id }, as: 'active' });
  yield {
    line: LINES.delete.two,
    events,
    note: via.length === 0 ? `The right child ${succ.key} has no left child, so it is the successor.` : `Go right to ${right.key}, then left to the end: the successor is ${succ.key}.`,
    phase,
    ask: {
      kind: 'pick',
      level: 'guided',
      prompt: `Who is the in-order successor of ${label}?`,
      answer: succ.id,
      candidates: subtree,
      rule: RULE_SUCC,
      distractors,
    },
  };

  const oldKey = n.key;
  n.key = succ.key;
  yield {
    line: LINES.delete.two,
    events: [
      { t: 'node.set', id: n.id, key: succ.key },
      { t: 'read', ref: { id: succ.id } },
      { t: 'var', name: 'copied', value: succ.key },
      { t: 'mark', ref: { id: n.id }, as: 'done' },
    ],
    note: `Copy ${succ.key} over ${oldKey}: the node keeps its place, and ${succ.key} must now leave the right subtree.`,
    phase,
  };

  // The successor has no left child, so this is the leaf or one-child path.
  yield* deleteNode(m, succ, `the successor ${succ.key}`, phase, LINES.delete.succ);
}
