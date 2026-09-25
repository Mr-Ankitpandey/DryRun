import type { AlgorithmModule } from '@/algorithms/types';
import { ids } from '@/engine/ids';
import type { State } from '@/engine/state';
import { arrayValues, emptyState, withArray } from '@/engine/state';
import type { InsertionSortInput } from './generator';
import { A, HOLD, generate } from './generator';
import { MAX_SIZE, decode, encode, presets, randomInput, validate } from './input';

export type { InsertionSortInput } from './generator';

export const pseudocode: Record<string, string[]> = {
  classic: [
    'for i = 1 .. n-1:',
    '    key = a[i]; j = i - 1',
    '    while j >= 0 and a[j] > key:',
    '        a[j+1] = a[j]              // shift, not swap',
    '        j = j - 1',
    '    a[j+1] = key',
  ],
};

/** Plain implementation used by tests: the sorted copy. */
export function reference(input: InsertionSortInput): number[] {
  return [...input.a].sort((p, q) => p - q);
}

const origIndex = (id: string): number => Number(id.slice(2));

/** What holds in every state:
 *  - the values in 'a' and 'hold' are exactly the input multiset;
 *  - with the key in hand (pass i = sorted.hi + 1): slots 0..i hold one gap at
 *    j + 1, the other values there are sorted, and everything right of the gap
 *    is > key; with the hand empty: a[0..sorted.hi] is full and sorted;
 *  - equal values inside the prefix keep their input order (stability);
 *  - slots right of the prefix are untouched. */
export function invariantCheck(state: State, input: InsertionSortInput): string | null {
  const arr = state.arrays[A];
  if (!arr) return 'no array a';
  const heldId = state.arrays[HOLD]?.slots[0] ?? null;
  const values = arrayValues(state, A);
  const bag = values.filter((v): v is number => v !== null);
  const held = heldId === null ? null : (state.elements[heldId]?.value ?? null);
  if (held !== null) bag.push(held);
  const want = reference(input);
  if (bag.sort((p, q) => p - q).join() !== want.join()) return `values changed: ${bag.join()} vs ${want.join()}`;

  const region = state.regions.sorted;
  if (!region || region.range === null) {
    // Only the initial state (before setup) and the empty array have no prefix.
    if (region && input.a.length > 0) return 'sorted region is empty on a non-empty array';
    if (heldId !== null) return 'a key is lifted before the sorted prefix exists';
    const moved = arr.slots.findIndex((id, k) => id !== ids.el(k));
    return moved === -1 ? null : `slot ${moved} changed before the sorted prefix exists`;
  }
  const r = region.range[1];
  if (heldId === null && typeof state.vars.i === 'number' && state.vars.i !== r) return `pass i = ${state.vars.i} ended but the sorted prefix ends at ${r}`;
  const end = heldId === null ? r : r + 1;
  if (end >= arr.slots.length) return `prefix end ${end} is outside the array`;

  const gaps = arr.slots.map((id, k) => (id === null ? k : -1)).filter((k) => k !== -1);
  if (heldId === null && gaps.length > 0) return `slot ${gaps[0]} is empty with no key lifted`;
  if (heldId !== null) {
    if (gaps.length !== 1) return `expected exactly one gap while the key is lifted, found ${gaps.length}`;
    const gap = gaps[0] as number;
    if (gap > end) return `the gap ${gap} is right of the pass index ${end}`;
    if (state.vars.j !== gap - 1) return `j = ${String(state.vars.j)} but the gap is at ${gap}`;
    for (let k = gap + 1; k <= end; k++) {
      if ((values[k] as number) <= (held as number)) return `a[${k}] = ${values[k]} sits right of the gap but is not > key ${held}`;
    }
  }
  let prev: { v: number; id: string } | null = null;
  for (let k = 0; k <= end; k++) {
    const id = arr.slots[k];
    if (id === null || id === undefined) continue;
    const v = values[k] as number;
    if (prev && prev.v > v) return `prefix is not sorted at slot ${k}: ${prev.v} > ${v}`;
    if (prev && prev.v === v && origIndex(prev.id) > origIndex(id)) return `equal values ${v} swapped order (${prev.id} before ${id}): not stable`;
    prev = { v, id };
  }
  for (let k = end + 1; k < arr.slots.length; k++) {
    if (arr.slots[k] !== ids.el(k)) return `slot ${k} right of the prefix was touched`;
  }
  return null;
}

export const insertionSort: AlgorithmModule<InsertionSortInput> = {
  meta: {
    id: 'insertion-sort',
    title: 'Insertion sort',
    family: 'sort',
    renderers: ['array'],
    panels: ['vars'],
    tieBreak: 'The scan continues only while a[j] > key, so an equal element stops the key and equal values keep their order.',
    minutes: 4,
    caps: { maxSteps: 160, maxSize: MAX_SIZE },
    variants: [{ id: 'classic', title: 'Shift with a lifted key' }],
  },
  pseudocode,
  invariant: { classic: { name: 'Sorted prefix', sentence: 'Everything left of i is sorted; key slides left until it is not smaller.' } },
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
  variantOf: () => 'classic',
};
