import type { AlgorithmModule } from '@/algorithms/types';
import { applyEvent } from '@/engine/reducer';
import type { State } from '@/engine/state';
import { arrayValues, emptyState, withArray } from '@/engine/state';
import { code } from './code';
import { A, HEAPS, MIN, generate } from './generator';
import { MAX_SIZE, decode, encode, presets, randomInput, validate } from './input';
import type { HeapInput, HeapResult } from './model';
import { parentOf, runOp } from './model';

export type { HeapInput, HeapOp, HeapResult } from './model';

/** docs/ALGORITHMS.md §11. Sift-down is Sedgewick's sink: find the smaller
 *  child (left on ties), stop when the value is not larger than it. */
const SIFT_DOWN = [
  '        l = 2i + 1; r = 2i + 2',
  '        if l >= n: break                  // a leaf',
  '        c = l',
  '        if r < n and a[r] < a[l]: c = r   // smaller child, left on ties',
  '        if a[i] <= a[c]: break            // heap order holds',
  '        swap a[i], a[c]',
  '        i = c',
];

export const pseudocode: Record<string, string[]> = {
  insert: [
    'insert(x):',
    '    a[n] = x; i = n; n = n + 1',
    '    while i > 0:',
    '        p = (i - 1) / 2                // rounded down',
    '        if a[p] <= a[i]: break         // heap order holds',
    '        swap a[i], a[p]',
    '        i = p',
  ],
  extract: [
    'extractMin():',
    '    if n == 0: return none',
    '    min = a[0]; n = n - 1',
    '    a[0] = a[n]                        // the last element fills the root',
    '    i = 0',
    '    while true:',
    ...SIFT_DOWN,
    '    return min',
  ],
  build: [
    'buildHeap(a):',
    '    for k = n/2 - 1 down to 0:         // the last parent first',
    '        siftDown(k)',
    'siftDown(i):',
    '    while true:',
    ...SIFT_DOWN.map((l) => l.replace(': break', ': return')),
  ],
};

export function reference(input: HeapInput): HeapResult {
  return runOp(input).result;
}

function result(final: State): HeapResult {
  const heap = (final.arrays[A] ? arrayValues(final, A) : []).filter((v): v is number => v !== null);
  const min = final.arrays[MIN] ? arrayValues(final, MIN)[0] : null;
  return { heap, extracted: min ?? null };
}

/** What holds in every state:
 *  - the values in 'a' and 'min' are the input (plus x once inserted);
 *  - the heap order a[parent(c)] <= a[c] holds for every occupied pair, except
 *    the pair where the moving value sits: (parent(i), i) while sifting up,
 *    (i, child) while sifting down (var i; null when no value is moving);
 *  - build: only pairs whose parent is at or after k are in order yet, and the
 *    'heaps' region covers exactly the slots after the current parent k;
 *  - the element the generator marks active is the one at slot i. */
export function invariantCheck(state: State, input: HeapInput): string | null {
  const arr = state.arrays[A];
  if (!arr) return 'no array a';
  const values = arrayValues(state, A);
  const bag = values.filter((v): v is number => v !== null);
  const taken = state.arrays[MIN] ? arrayValues(state, MIN)[0] : null;
  if (taken !== null && taken !== undefined) bag.push(taken);
  const inserted = input.op === 'insert' && typeof state.vars.x === 'number';
  const want = [...input.a, ...(inserted ? [input.x] : [])].sort((p, q) => p - q);
  if ([...bag].sort((p, q) => p - q).join() !== want.join()) return `values changed: ${bag.join()} vs ${want.join()}`;

  const i = typeof state.vars.i === 'number' ? state.vars.i : -1;
  const k = typeof state.vars.k === 'number' ? state.vars.k : null;
  if (input.op === 'build' && k === null) return null; // before the build starts, the array is arbitrary
  for (let c = 1; c < values.length; c++) {
    const p = parentOf(c);
    const pv = values[p];
    const cv = values[c];
    if (pv === null || cv === null || pv === undefined || cv === undefined) continue;
    if (input.op === 'insert' && c === i) continue;
    if (input.op !== 'insert' && p === i) continue;
    if (input.op === 'build' && k !== null && p < k) continue;
    if (pv > cv) return `heap order broken: a[${p}] = ${pv} > a[${c}] = ${cv} (i = ${i})`;
  }
  if (i >= 0) {
    const id = arr.slots[i];
    if (!id || state.elements[id]?.mark !== 'active') return `the moving value is not at i = ${i}`;
  }
  if (input.op === 'build' && k !== null && k >= 0) {
    const region = state.regions[HEAPS];
    if (!region || !region.range || region.range[1] !== values.length - 1) return 'heaps region missing or not ending at n - 1';
    if (region.range[0] !== k + 1 && region.range[0] !== k) return `heaps region starts at ${region.range[0]} with k = ${k}`;
  }
  return null;
}

const SENTENCE = 'Every parent is ≤ its children, except where the moving value at i is still out of place.';

export const heap: AlgorithmModule<HeapInput> = {
  meta: {
    id: 'heap',
    title: 'Binary heap (min)',
    family: 'tree',
    renderers: ['array', 'tree'],
    panels: ['vars'],
    tieBreak: 'Sift-down compares with the smaller child, the left one when they are equal; equal values never swap.',
    minutes: 4,
    caps: { maxSteps: 60, maxSize: MAX_SIZE },
    variants: [
      { id: 'insert', title: 'Insert' },
      { id: 'extract', title: 'Extract min' },
      { id: 'build', title: 'Build heap' },
    ],
    fieldLabels: { x: 'Value to insert (insert only)' },
  },
  pseudocode,
  code,
  invariant: {
    insert: { name: 'Heap order', sentence: SENTENCE },
    extract: { name: 'Heap order', sentence: SENTENCE },
    build: { name: 'Heap order', sentence: 'Every slot after k heads a heap; the value at i is still sifting down.' },
  },
  initialState: (input) => {
    let s = applyEvent(withArray(emptyState(), A, input.a), { t: 'array.tree', arr: A });
    if (input.op === 'extract') s = applyEvent(s, { t: 'array', name: MIN, size: 1 });
    return s;
  },
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
