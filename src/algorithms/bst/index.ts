import type { AlgorithmModule } from '@/algorithms/types';
import type { Id } from '@/engine/events';
import type { State, TreeNode } from '@/engine/state';
import { emptyState } from '@/engine/state';
import type { BstInput } from './generator';
import { generate } from './generator';
import type { PlainNode } from './input';
import { MAX_SIZE, decode, encode, plainBuild, presets, randomInput, validate } from './input';

export type { BstInput, BstOp } from './generator';

const INSERT = ['insert(node, x):', '    if node is null: return new Node(x)', '    if x < node.key: node.left = insert(node.left, x)', '    else: node.right = insert(node.right, x)', '    return node'];

/** docs/ALGORITHMS.md §5: insert is lines 1–5 (also the build prelude), delete is
 *  lines 6–14. Search is not listed there; it takes lines 6–10 of its own variant. */
export const pseudocode: Record<string, string[]> = {
  insert: INSERT,
  delete: [
    ...INSERT,
    'delete(node, x):',
    '    if node is null: return null',
    '    if x < node.key: node.left = delete(node.left, x)',
    '    else if x > node.key: node.right = delete(node.right, x)',
    '    else if node.left is null: return node.right          // 0 or 1 child',
    '    else if node.right is null: return node.left',
    '    else: s = min(node.right); node.key = s.key;         // two children',
    '          node.right = delete(node.right, s.key)',
    '    return node',
  ],
  search: [
    ...INSERT,
    'search(node, x):',
    '    if node is null: return not found',
    '    if x == node.key: return node',
    '    if x < node.key: return search(node.left, x)',
    '    else: return search(node.right, x)',
  ],
};

export interface BstResult {
  inorder: number[];
  /** Keys compared on the operation's walk, root first. */
  path: number[];
  /** Whether x was in the tree before the operation. */
  found: boolean;
}

function inorderPlain(n: PlainNode | null, out: number[] = []): number[] {
  if (n === null) return out;
  inorderPlain(n.left, out);
  out.push(n.key);
  inorderPlain(n.right, out);
  return out;
}

function plainDelete(n: PlainNode | null, x: number): PlainNode | null {
  if (n === null) return null;
  if (x < n.key) n.left = plainDelete(n.left, x);
  else if (x > n.key) n.right = plainDelete(n.right, x);
  else if (n.left === null) return n.right;
  else if (n.right === null) return n.left;
  else {
    let s = n.right;
    while (s.left !== null) s = s.left;
    n.key = s.key;
    n.right = plainDelete(n.right, s.key);
  }
  return n;
}

/** Plain implementation used by tests. */
export function reference(input: BstInput): BstResult {
  let root = plainBuild(input.keys);
  const path: number[] = [];
  let cur = root;
  let found = false;
  while (cur !== null) {
    path.push(cur.key);
    if (cur.key === input.x) {
      found = true;
      break;
    }
    cur = input.x < cur.key ? cur.left : cur.right;
  }
  if (input.op === 'insert' && !found) {
    root = plainBuild([...input.keys, input.x]);
  } else if (input.op === 'delete') {
    root = plainDelete(root, input.x);
  }
  return { inorder: inorderPlain(root), path, found };
}

function inorderState(state: State, root: Id | null, out: number[] = []): number[] {
  if (root === null) return out;
  const n = state.tree[root];
  if (!n) return out;
  inorderState(state, n.left, out);
  out.push(n.key);
  inorderState(state, n.right, out);
  return out;
}

function result(final: State): BstResult {
  const path = typeof final.vars.path === 'string' && final.vars.path !== '' ? final.vars.path.split(',').map(Number) : [];
  return { inorder: inorderState(final, final.root), path, found: final.vars.found === true };
}

/** BST property for every tree in the state (the rooted one and any floating
 *  subtree mid-delete), link consistency both ways, one root or none. While a
 *  two-child delete has copied the successor's key up (`vars.copied`), that one
 *  key may appear twice in a row until the successor is removed. */
export function invariantCheck(state: State): string | null {
  const { tree, root } = state;
  if (root !== null) {
    const r = tree[root];
    if (!r) return `root ${root} is not a node`;
    if (r.parent !== null) return `root ${root} has a parent`;
  }
  const copied = typeof state.vars.copied === 'number' ? state.vars.copied : null;
  const seen = new Set<Id>();
  for (const n of Object.values(tree)) {
    if (n.parent !== null) {
      const p = tree[n.parent];
      if (!p) return `${n.id}: parent ${n.parent} missing`;
      const asLeft = p.left === n.id;
      const asRight = p.right === n.id;
      if (asLeft === asRight) return `${n.id}: parent ${p.id} links it ${asLeft ? 'twice' : 'never'}`;
    }
    for (const side of ['left', 'right'] as const) {
      const c = n[side];
      if (c === null) continue;
      const child = tree[c];
      if (!child) return `${n.id}.${side} = ${c} missing`;
      if (child.parent !== n.id) return `${c}.parent is ${child.parent}, expected ${n.id}`;
    }
    if (n.left !== null && n.left === n.right) return `${n.id} has the same node on both sides`;
  }
  const roots = Object.values(tree).filter((n) => n.parent === null);
  for (const r of roots) {
    const keys: number[] = [];
    const err = collect(tree, r.id, keys, seen);
    if (err) return err;
    let dupUsed = false;
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1] as number;
      const b = keys[i] as number;
      if (a < b) continue;
      if (a === b && a === copied && !dupUsed) {
        dupUsed = true;
        continue;
      }
      return `in-order keys not increasing at ${a}, ${b} (tree at ${r.id})`;
    }
  }
  if (seen.size !== Object.keys(tree).length) return 'some nodes are unreachable from any root (cycle?)';
  return null;
}

function collect(tree: Record<Id, TreeNode>, id: Id | null, out: number[], seen: Set<Id>): string | null {
  if (id === null) return null;
  if (seen.has(id)) return `cycle through ${id}`;
  seen.add(id);
  const n = tree[id];
  if (!n) return `missing node ${id}`;
  const l = collect(tree, n.left, out, seen);
  if (l) return l;
  out.push(n.key);
  return collect(tree, n.right, out, seen);
}

export const bst: AlgorithmModule<BstInput> = {
  meta: {
    id: 'bst',
    title: 'BST insert, search, delete',
    family: 'tree',
    renderers: ['tree'],
    panels: ['vars'],
    tieBreak: 'Keys are distinct; a two-child delete uses the in-order successor (minimum of the right subtree).',
    minutes: 4,
    caps: { maxSteps: 110, maxSize: MAX_SIZE },
    variants: [
      { id: 'insert', title: 'Insert' },
      { id: 'search', title: 'Search' },
      { id: 'delete', title: 'Delete' },
    ],
  },
  pseudocode,
  invariant: {
    insert: { name: 'BST property', sentence: 'Everything left of a node is smaller; everything right is larger.' },
    search: { name: 'BST property', sentence: 'Everything left of a node is smaller; everything right is larger.' },
    delete: { name: 'BST property', sentence: 'Everything left of a node is smaller; everything right is larger.' },
  },
  initialState: () => emptyState(),
  generate,
  reference,
  result,
  invariantCheck,
  presets,
  randomInput,
  validate,
  encode,
  decode,
  variantOf: (input) => input.op,
};

export { plainBuild };
