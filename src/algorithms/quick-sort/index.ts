import type { AlgorithmModule } from '@/algorithms/types';
import type { State } from '@/engine/state';
import { arrayValues, emptyState, withArray } from '@/engine/state';
import type { QuickSortInput } from './generator';
import { generate } from './generator';
import { MAX_SIZE, decode, encode, presets, randomInput, validate } from './input';

export type { QuickSortInput } from './generator';

export const pseudocode: Record<string, string[]> = {
  lomuto: [
    'quicksort(lo, hi):',
    '    if lo >= hi: return',
    '    p = partition(lo, hi)',
    '    quicksort(lo, p - 1)',
    '    quicksort(p + 1, hi)',
    'partition(lo, hi):',
    '    pivot = a[hi]; i = lo - 1',
    '    for j = lo .. hi - 1:',
    '        if a[j] < pivot:',
    '            i = i + 1; swap a[i], a[j]',
    '    swap a[i+1], a[hi]',
    '    return i + 1',
  ],
};

/** Plain implementation used by tests: the sorted copy. */
export function reference(input: QuickSortInput): number[] {
  return [...input.a].sort((p, q) => p - q);
}

/** Always: the multiset of values is unchanged and every element marked done sits
 *  at its final sorted index. Inside an active partition (vars.phase = 'partition'):
 *  a[lo..i] < pivot and a[i+1..j−1] ≥ pivot. */
export function invariantCheck(state: State, input: QuickSortInput): string | null {
  const a = arrayValues(state, 'a');
  if (a.some((v) => v === null)) return 'an array slot is empty';
  const values = a as number[];
  const sorted = reference(input);
  const bag = [...values].sort((p, q) => p - q);
  if (bag.join() !== sorted.join()) return `values changed: ${bag.join()} vs ${sorted.join()}`;
  const arr = state.arrays.a;
  if (!arr) return 'no array a';
  for (let k = 0; k < arr.slots.length; k++) {
    const id = arr.slots[k];
    if (id === null || id === undefined) continue;
    const el = state.elements[id];
    if (el?.mark === 'done' && el.value !== sorted[k]) return `done element ${id} = ${el.value} at index ${k}, but sorted[${k}] = ${sorted[k]}`;
  }
  if (state.vars.phase !== 'partition') return null;
  const { lo, hi, i, j, pivot } = state.vars;
  if (typeof lo !== 'number' || typeof hi !== 'number' || typeof i !== 'number' || typeof j !== 'number' || typeof pivot !== 'number') {
    return 'partition vars missing';
  }
  for (let k = lo; k <= i; k++) if ((values[k] as number) >= pivot) return `a[${k}] = ${values[k]} is not < pivot ${pivot} although ${k} ≤ i = ${i}`;
  for (let k = i + 1; k <= j - 1 && k < hi; k++) if ((values[k] as number) < pivot) return `a[${k}] = ${values[k]} is not ≥ pivot ${pivot} although i < ${k} < j = ${j}`;
  return null;
}

export const quickSort: AlgorithmModule<QuickSortInput> = {
  meta: {
    id: 'quick-sort',
    title: 'Quick sort (Lomuto)',
    family: 'sort',
    renderers: ['array'],
    panels: ['callstack', 'vars'],
    tieBreak: 'The pivot is a[hi]; only a[j] < pivot swaps, so equal values stay on the ≥ side; the left segment is sorted before the right one.',
    minutes: 6,
    caps: { maxSteps: 320, maxSize: MAX_SIZE },
    variants: [{ id: 'lomuto', title: 'Lomuto partition' }],
  },
  pseudocode,
  invariant: { lomuto: { name: 'Partition regions', sentence: 'Left of i + 1 is < pivot; between i + 1 and j is ≥ pivot; j onward is unscanned.' } },
  initialState: (input) => withArray(emptyState(), 'a', input.a),
  generate,
  reference,
  result: (final) => arrayValues(final, 'a'),
  invariantCheck,
  presets,
  randomInput,
  validate,
  encode,
  decode,
  variantOf: () => 'lomuto',
};
