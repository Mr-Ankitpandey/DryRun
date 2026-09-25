import type { AlgorithmModule } from '@/algorithms/types';
import type { Id } from '@/engine/events';
import type { State } from '@/engine/state';
import { arrayValues, emptyState, topFrame, withArray } from '@/engine/state';
import type { MergeSortInput } from './generator';
import { A, AUX, generate } from './generator';
import { MAX_SIZE, decode, encode, presets, randomInput, validate } from './input';

export type { MergeSortInput } from './generator';

export const pseudocode: Record<string, string[]> = {
  topdown: [
    'mergesort(lo, hi):',
    '    if hi - lo < 1: return',
    '    mid = lo + (hi - lo) / 2',
    '    mergesort(lo, mid); mergesort(mid + 1, hi)',
    '    merge(lo, mid, hi)',
    'merge(lo, mid, hi):',
    '    i = lo; j = mid + 1; k = lo',
    '    while i <= mid and j <= hi:',
    '        if a[i] <= a[j]: aux[k++] = a[i++]',
    '        else:            aux[k++] = a[j++]',
    '    copy the rest of the left half, then the right half',
    '    copy aux[lo..hi] back to a',
  ],
};

/** Plain implementation used by tests: the sorted copy. */
export function reference(input: MergeSortInput): number[] {
  return [...input.a].sort((p, q) => p - q);
}

const origIndex = (id: Id): number => Number(id.slice(2));

/** Checks that the elements at the given slots are non-decreasing and that
 *  equal values keep their input order. `null` slots are reported. */
function sortedRun(state: State, arr: string, lo: number, hi: number, what: string): string | null {
  const slots = state.arrays[arr]?.slots ?? [];
  let prev: { v: number; id: Id } | null = null;
  for (let s = lo; s <= hi; s++) {
    const id = slots[s];
    if (id === null || id === undefined) return `${what}: ${arr}[${s}] is empty`;
    const v = state.elements[id]?.value as number;
    if (prev && prev.v > v) return `${what}: ${arr}[${s}] = ${v} follows ${prev.v}`;
    if (prev && prev.v === v && origIndex(prev.id) > origIndex(id)) return `${what}: equal values ${v} out of input order (not stable)`;
    prev = { v, id };
  }
  return null;
}

/** What holds in every state:
 *  - the values in 'a' and 'aux' are exactly the input multiset;
 *  - every `sorted:*` region covers a full, sorted, stable run of 'a' (while it
 *    is being merged, its remaining elements are still sorted);
 *  - outside a merge, 'aux' is empty;
 *  - during a merge of [lo, mid] and [mid+1, hi] (carets i, j, k):
 *    k − lo = (i − lo) + (j − mid − 1); aux[lo..k−1] is a sorted stable run;
 *    a[i..mid] and a[j..hi] are full sorted runs, their consumed slots are empty;
 *    and nothing copied is larger than a remaining front. */
export function invariantCheck(state: State, input: MergeSortInput): string | null {
  const a = arrayValues(state, A);
  const aux = state.arrays[AUX] ? arrayValues(state, AUX) : [];
  const bag = [...a, ...aux].filter((v): v is number => v !== null).sort((p, q) => p - q);
  const want = reference(input);
  if (bag.join() !== want.join()) return `values changed: ${bag.join()} vs ${want.join()}`;

  const pi = state.pointers.i ?? null;
  const pj = state.pointers.j ?? null;
  const pk = state.pointers.k ?? null;
  const merging = pk !== null;

  for (const [name, region] of Object.entries(state.regions)) {
    if (region.range === null) continue;
    const [lo, hi] = region.range;
    if (merging) {
      // The runs being merged are consumed from the left: check what remains.
      const rest: number[] = [];
      for (let s = lo; s <= hi; s++) if (a[s] !== null) rest.push(a[s] as number);
      for (let x = 1; x < rest.length; x++) if ((rest[x - 1] as number) > (rest[x] as number)) return `region ${name}: remaining values not sorted`;
      continue;
    }
    const bad = sortedRun(state, A, lo, hi, `region ${name}`);
    if (bad) return bad;
  }

  if (!merging) {
    if (pi !== null || pj !== null) return 'i/j carets outside a merge';
    if (aux.some((v) => v !== null)) return 'aux holds elements outside a merge';
    if (a.some((v) => v === null)) return 'a has an empty slot outside a merge';
    return null;
  }

  const f = topFrame(state);
  const lo = f?.args.lo;
  const hi = f?.args.hi;
  const mid = f?.args.mid;
  if (typeof lo !== 'number' || typeof hi !== 'number' || typeof mid !== 'number') return 'merging without lo/mid/hi on the top frame';
  if (pi === null || pj === null) return 'merge without i/j carets';
  const [i, j, k] = [pi.i, pj.i, pk.i];
  if (k - lo !== i - lo + (j - mid - 1)) return `k = ${k} does not match i = ${i}, j = ${j}`;
  if (i < lo || i > mid + 1 || j < mid + 1 || j > hi + 1) return `carets out of range: i = ${i}, j = ${j}`;
  const copied = sortedRun(state, AUX, lo, k - 1, 'aux run');
  if (copied) return copied;
  const left = sortedRun(state, A, i, mid, 'left run');
  if (left) return left;
  const right = sortedRun(state, A, j, hi, 'right run');
  if (right) return right;
  for (let s = lo; s < i; s++) if (a[s] !== null) return `a[${s}] should be consumed`;
  for (let s = mid + 1; s < j; s++) if (a[s] !== null) return `a[${s}] should be consumed`;
  for (let s = 0; s < aux.length; s++) if ((s < lo || s >= k) && aux[s] !== null) return `aux[${s}] is outside the merged prefix`;
  if (k > lo) {
    const last = aux[k - 1] as number;
    if (i <= mid && (a[i] as number) < last) return `left front ${a[i]} is smaller than copied ${last}`;
    if (j <= hi && (a[j] as number) < last) return `right front ${a[j]} is smaller than copied ${last}`;
    // Left-half elements come from earlier input positions: a right element copied
    // ahead of an equal left front breaks stability.
    const lastId = state.arrays[AUX]?.slots[k - 1] as Id;
    const leftFront = i <= mid ? (state.arrays[A]?.slots[i] as Id) : null;
    if (leftFront !== null && a[i] === last && origIndex(lastId) > origIndex(leftFront)) return `right ${last} copied before an equal left front (not stable)`;
  }
  return null;
}

export const mergeSort: AlgorithmModule<MergeSortInput> = {
  meta: {
    id: 'merge-sort',
    title: 'Merge sort (top-down)',
    family: 'sort',
    renderers: ['array'],
    panels: ['callstack'],
    tieBreak: 'mid rounds down, so the left half is the shorter-or-equal one; on equal fronts the left element is copied first.',
    minutes: 6,
    caps: { maxSteps: 220, maxSize: MAX_SIZE },
    variants: [{ id: 'topdown', title: 'Top-down, stable' }],
  },
  pseudocode,
  invariant: { topdown: { name: 'Sorted runs', sentence: 'Both halves are sorted; take the smaller front, left first on ties.' } },
  initialState: (input) => withArray(emptyState(), A, input.a),
  generate,
  reference,
  result: (final) => arrayValues(final, A),
  invariantCheck,
  presets,
  randomInput,
  validate,
  encode,
  decode,
  variantOf: () => 'topdown',
};
