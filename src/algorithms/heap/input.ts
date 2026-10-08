/** Input codec, validation, presets and constrained random inputs for the heap.
 *  URL form: i=1,3,2,7&op=insert&x=0 (x is always carried; only insert uses it).
 *  insert and extract start from a valid min-heap (the validator says which
 *  pair breaks the order); build takes any array. */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import { decodeIntList, encodeIntList } from '@/lib/url';
import type { HeapInput, HeapOp } from './model';
import { firstViolation, heapify, parentOf, runOp } from './model';

export const MAX_SIZE = 15;
export const MIN_VALUE = 0;
export const MAX_VALUE = 99;
export const OPS: HeapOp[] = ['insert', 'extract', 'build'];

export const presets: Preset<HeapInput>[] = [
  { id: 'insert-bubbles-to-root', title: 'Insert a new minimum', input: { a: [2, 5, 3, 8, 9, 4, 7], op: 'insert', x: 1 }, why: '1 is smaller than every parent on its way: it rises three levels to the root.' },
  { id: 'insert-stays', title: 'Insert a large value', input: { a: [1, 3, 2, 7, 8], op: 'insert', x: 9 }, why: 'The parent is already smaller: the new value stays where it landed.' },
  { id: 'insert-equal-parent', title: 'Insert a value equal to its parent', input: { a: [2, 4, 3], op: 'insert', x: 4 }, why: 'Equal is in order: the new 4 does not swap with the 4 above it.' },
  { id: 'extract-sinks-left', title: 'Extract: the last value sinks left', input: { a: [1, 2, 5, 3, 4, 8, 9, 6], op: 'extract', x: 0 }, why: '6 fills the root and follows the smaller child, the left one, twice.' },
  { id: 'extract-sinks-right', title: 'Extract: the last value sinks right', input: { a: [1, 5, 2, 6, 7, 4, 3, 9], op: 'extract', x: 0 }, why: '9 fills the root; both times the right child is the smaller one.' },
  { id: 'duplicates', title: 'Extract with equal children', input: { a: [1, 4, 4, 6, 5, 7, 8], op: 'extract', x: 0 }, why: 'The two children of the root are both 4: the left one is kept.' },
  { id: 'build-reverse', title: 'Build from a reverse-sorted array', input: { a: [9, 8, 7, 6, 5, 4, 3, 2, 1], op: 'build', x: 0 }, why: 'Every parent is larger than its children: most sifts go all the way down.' },
  { id: 'build-sorted', title: 'Build from a sorted array', input: { a: [1, 2, 3, 4, 5, 6, 7], op: 'build', x: 0 }, why: 'A sorted array is already a heap: every sift stops at once.' },
  { id: 'single', title: 'Extract from one value', input: { a: [5], op: 'extract', x: 0 }, why: 'The root is the only value: taking it leaves an empty heap.' },
  { id: 'empty-extract', title: 'Extract from an empty heap', input: { a: [], op: 'extract', x: 0 }, why: 'n = 0: there is nothing to take, and extractMin says so.' },
];

export function validate(raw: Record<string, string>): ValidationResult<HeapInput> {
  const a = decodeIntList(raw.i ?? '', { min: MIN_VALUE, max: MAX_VALUE, maxLen: MAX_SIZE });
  if (a === null) return { ok: false, error: `Enter up to ${MAX_SIZE} whole numbers between ${MIN_VALUE} and ${MAX_VALUE}, separated by commas.` };
  const op = (raw.op ?? 'insert') as HeapOp;
  if (!OPS.includes(op)) return { ok: false, error: 'Choose an operation: insert, extract or build.' };
  const xs = (raw.x ?? '').trim();
  let x = 0;
  if (xs !== '' || op === 'insert') {
    if (!/^-?\d+$/.test(xs)) return { ok: false, error: 'Enter a whole number for the value to insert.' };
    x = Number(xs);
    if (x < MIN_VALUE || x > MAX_VALUE) return { ok: false, error: `The value to insert must be between ${MIN_VALUE} and ${MAX_VALUE}.` };
  }
  if (op !== 'build') {
    const bad = firstViolation(a);
    if (bad !== null) {
      const p = parentOf(bad);
      return { ok: false, error: `Not a min-heap: a[${bad}] = ${a[bad]} is smaller than its parent a[${p}] = ${a[p]}. Use build to heapify it first.` };
    }
  }
  if (op === 'insert' && a.length >= MAX_SIZE) return { ok: false, error: `A heap here holds at most ${MAX_SIZE} values: remove one before inserting.` };
  return { ok: true, input: { a, op, x } };
}

export function encode(input: HeapInput): Record<string, string> {
  return { i: encodeIntList(input.a), op: input.op, x: String(input.x) };
}

export function decode(params: Record<string, string>): HeapInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Targets: 'insert' | 'extract' | 'build' (the operation), 'ties' (a sift meets
 *  an equal value), 'deep' (one value travels at least two levels, and some
 *  sift runs out of room at the root or a leaf). */
export function randomInput(rng: Rng, target?: string): HeapInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const op: HeapOp = target === 'insert' || target === 'extract' || target === 'build' ? target : rng.pick(OPS);
    const narrow = target === 'ties' || rng.next() < 0.2;
    const value = () => (narrow ? rng.int(0, 12) : rng.int(MIN_VALUE, MAX_VALUE));
    const n = op === 'insert' ? rng.int(3, MAX_SIZE - 1) : op === 'extract' ? rng.int(3, MAX_SIZE) : rng.int(4, MAX_SIZE);
    const values = Array.from({ length: n }, value);
    const a = op === 'build' ? values : heapify(values);
    // Insert small values more often so they climb.
    const x = op === 'insert' ? (rng.next() < 0.6 ? rng.int(MIN_VALUE, Math.max(MIN_VALUE, Math.min(...a))) : value()) : 0;
    const input: HeapInput = { a, op, x };
    const { stats } = runOp(input);
    if (target === 'ties' && !stats.tie) continue;
    if (target === 'deep' && (stats.longest < 2 || !stats.end)) continue;
    return input;
  }
  const id = target === 'extract' ? 'extract-sinks-left' : target === 'build' ? 'build-reverse' : target === 'ties' ? 'duplicates' : target === 'deep' ? 'build-reverse' : 'insert-bubbles-to-root';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<HeapInput>);
  return structuredClone(fallback.input);
}
