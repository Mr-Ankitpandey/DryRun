/** Input codec, validation, presets and constrained random inputs for the BST module. */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import { decodeIntList, encodeIntList } from '@/lib/url';
import type { BstInput, BstOp } from './generator';

export const MAX_SIZE = 15;
export const MAX_DEPTH = 5;
export const MIN_VALUE = 0;
export const MAX_VALUE = 99;
export const OPS: BstOp[] = ['insert', 'search', 'delete'];

/** Plain node used by validation and the reference implementation. */
export interface PlainNode {
  key: number;
  left: PlainNode | null;
  right: PlainNode | null;
}

export function plainInsert(root: PlainNode | null, key: number): PlainNode {
  if (root === null) return { key, left: null, right: null };
  if (key < root.key) root.left = plainInsert(root.left, key);
  else if (key > root.key) root.right = plainInsert(root.right, key);
  return root;
}

export function plainBuild(keys: readonly number[]): PlainNode | null {
  let root: PlainNode | null = null;
  for (const k of keys) root = plainInsert(root, k);
  return root;
}

/** Depth of the deepest node; the root has depth 0, an empty tree −1. */
export function plainDepth(root: PlainNode | null): number {
  if (root === null) return -1;
  return 1 + Math.max(plainDepth(root.left), plainDepth(root.right));
}

export const presets: Preset<BstInput>[] = [
  { id: 'balanced', title: 'Balanced tree, search hit', input: { keys: [50, 25, 75, 12, 37, 62, 87], op: 'search', x: 37 }, why: 'Every comparison halves the tree; the path is two turns long.' },
  { id: 'delete-leaf', title: 'Delete a leaf', input: { keys: [8, 3, 10, 1, 6, 14], op: 'delete', x: 1 }, why: 'No children: the node simply goes and its parent link empties.' },
  { id: 'delete-one-child', title: 'Delete a node with one child', input: { keys: [8, 3, 10, 1, 6, 14, 13], op: 'delete', x: 10 }, why: 'The only child (with its subtree) is relinked to the grandparent.' },
  { id: 'delete-two-children', title: 'Delete a node with two children', input: { keys: [8, 3, 10, 1, 6, 14, 4, 7, 13, 5], op: 'delete', x: 3 }, why: 'The in-order successor 4 is copied up, then removed by the one-child path.' },
  { id: 'delete-root', title: 'Delete the root (one child)', input: { keys: [8, 10, 9, 14], op: 'delete', x: 8 }, why: 'The same relink with parent null: the child becomes the root.' },
  { id: 'delete-root-two-children', title: 'Delete the root (two children)', input: { keys: [8, 3, 10, 1, 6, 14, 13], op: 'delete', x: 8 }, why: 'The right child has no left child, so it is the successor itself.' },
  { id: 'search-miss', title: 'Search for an absent key', input: { keys: [8, 3, 10, 1, 6, 14], op: 'search', x: 7 }, why: 'The walk ends at an empty slot: the key is not there.' },
  { id: 'insert-left-spine', title: 'Insert into a left spine', input: { keys: [9, 7, 5, 3], op: 'insert', x: 1 }, why: 'Descending input degenerates into a list; every step goes left.' },
  { id: 'insert-existing', title: 'Insert a key that exists', input: { keys: [8, 3, 10], op: 'insert', x: 3 }, why: 'Keys are distinct here: the walk finds the key and nothing changes.' },
  { id: 'insert-empty', title: 'Insert into an empty tree', input: { keys: [], op: 'insert', x: 5 }, why: 'The first key becomes the root.' },
];

export function validate(raw: Record<string, string>): ValidationResult<BstInput> {
  const keys = decodeIntList(raw.i ?? '', { min: MIN_VALUE, max: MAX_VALUE, maxLen: MAX_SIZE });
  if (keys === null) return { ok: false, error: `Enter up to ${MAX_SIZE} whole numbers between ${MIN_VALUE} and ${MAX_VALUE}, separated by commas.` };
  if (new Set(keys).size !== keys.length) return { ok: false, error: 'BSTs here hold distinct keys.' };
  const op = (raw.op ?? 'search') as BstOp;
  if (!OPS.includes(op)) return { ok: false, error: 'Choose an operation: insert, search or delete.' };
  const xs = (raw.x ?? '').trim();
  if (!/^-?\d+$/.test(xs)) return { ok: false, error: 'Enter a whole number for x.' };
  const x = Number(xs);
  if (x < MIN_VALUE || x > MAX_VALUE) return { ok: false, error: `x must be between ${MIN_VALUE} and ${MAX_VALUE}.` };
  const root = plainBuild(keys);
  if (plainDepth(root) > MAX_DEPTH) return { ok: false, error: `The tree would be deeper than ${MAX_DEPTH} levels: reorder or remove keys.` };
  if (op === 'insert' && plainDepth(plainInsert(root, x)) > MAX_DEPTH) {
    return { ok: false, error: `Inserting ${x} would make the tree deeper than ${MAX_DEPTH} levels: reorder or remove keys.` };
  }
  return { ok: true, input: { keys, op, x } };
}

export function encode(input: BstInput): Record<string, string> {
  return { i: encodeIntList(input.keys), op: input.op, x: String(input.x) };
}

export function decode(params: Record<string, string>): BstInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Number of children a key has in the tree built from `keys`. */
function childCount(keys: readonly number[], x: number): number {
  let n = plainBuild(keys);
  while (n !== null && n.key !== x) n = x < n.key ? n.left : n.right;
  if (n === null) return -1;
  return (n.left === null ? 0 : 1) + (n.right === null ? 0 : 1);
}

/** Targets: 'two-children' | 'one-child' | 'leaf' | 'root' (delete cases) | 'insert' | 'search' | 'delete' | 'miss'. */
export function randomInput(rng: Rng, target?: string): BstInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = rng.int(3, 12);
    const keys = rng.shuffle(Array.from({ length: MAX_VALUE - MIN_VALUE + 1 }, (_, i) => MIN_VALUE + i)).slice(0, n);
    if (plainDepth(plainBuild(keys)) > MAX_DEPTH) continue;
    let op: BstOp;
    if (target === 'insert' || target === 'search' || target === 'delete') op = target;
    else if (target === 'two-children' || target === 'one-child' || target === 'leaf' || target === 'root' || target === 'miss') op = target === 'miss' ? rng.pick(['search', 'delete'] as const) : 'delete';
    else op = rng.next() < 0.5 ? 'delete' : rng.next() < 0.5 ? 'search' : 'insert';

    const absent = Array.from({ length: MAX_VALUE - MIN_VALUE + 1 }, (_, i) => MIN_VALUE + i).filter((v) => !keys.includes(v));
    let x: number;
    if (target === 'root') x = keys[0] as number;
    else if (target === 'two-children' || target === 'one-child' || target === 'leaf') {
      const want = target === 'two-children' ? 2 : target === 'one-child' ? 1 : 0;
      const pool = keys.filter((k) => childCount(keys, k) === want);
      if (pool.length === 0) continue;
      x = rng.pick(pool);
    } else if (target === 'miss') x = rng.pick(absent);
    else if (op === 'insert') x = rng.next() < 0.85 ? rng.pick(absent) : rng.pick(keys);
    else x = rng.next() < 0.7 ? rng.pick(keys) : rng.pick(absent);

    if (op === 'insert' && plainDepth(plainInsert(plainBuild(keys), x)) > MAX_DEPTH) continue;
    return { keys, op, x };
  }
  const id =
    target === 'two-children' ? 'delete-two-children' : target === 'one-child' ? 'delete-one-child' : target === 'leaf' ? 'delete-leaf' : target === 'root' ? 'delete-root' : target === 'insert' ? 'insert-left-spine' : target === 'miss' ? 'search-miss' : 'balanced';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<BstInput>);
  return structuredClone(fallback.input);
}
