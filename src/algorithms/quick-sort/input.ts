/** Input codec, validation, presets and constrained random inputs for quick sort. */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import { decodeIntList, encodeIntList } from '@/lib/url';
import type { QuickSortInput } from './generator';

export const MAX_SIZE = 12;
export const MIN_VALUE = 0;
export const MAX_VALUE = 99;

export const presets: Preset<QuickSortInput>[] = [
  { id: 'random', title: 'Random values', input: { a: [6, 2, 8, 4, 9, 1, 7, 3] }, why: 'A typical run: pivots land near the middle and the recursion tree stays shallow.' },
  { id: 'sorted', title: 'Already sorted (worst case)', input: { a: [1, 2, 3, 4, 5, 6, 7] }, why: 'Every pivot is the maximum: every compare swaps with itself and the tree becomes a chain.' },
  { id: 'all-equal', title: 'All equal', input: { a: [4, 4, 4, 4, 4, 4] }, why: 'a[j] < pivot is never true, so the pivot lands at lo and the right side keeps all the rest.' },
  { id: 'duplicates', title: 'Duplicates', input: { a: [3, 5, 3, 8, 5, 1, 3] }, why: 'Equal values stay on the ≥ side: watch which copy of 3 settles where.' },
  { id: 'reverse', title: 'Reverse sorted', input: { a: [7, 6, 5, 4, 3, 2, 1] }, why: 'The pivot is the minimum: nothing swaps in the loop and the final swap moves it to lo.' },
  { id: 'two', title: 'Two elements', input: { a: [9, 4] }, why: 'One compare, one final swap, two base-case calls.' },
  { id: 'single', title: 'One element', input: { a: [7] }, why: 'lo = hi: the call returns at once.' },
];

export function validate(raw: Record<string, string>): ValidationResult<QuickSortInput> {
  const a = decodeIntList(raw.i ?? '', { min: MIN_VALUE, max: MAX_VALUE, maxLen: MAX_SIZE });
  if (a === null) return { ok: false, error: `Enter up to ${MAX_SIZE} whole numbers between ${MIN_VALUE} and ${MAX_VALUE}, separated by commas.` };
  return { ok: true, input: { a } };
}

export function encode(input: QuickSortInput): Record<string, string> {
  return { i: encodeIntList(input.a) };
}

export function decode(params: Record<string, string>): QuickSortInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Targets: 'sorted' | 'reverse' | 'all-equal' | 'duplicates' | 'distinct'. */
export function randomInput(rng: Rng, target?: string): QuickSortInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = rng.int(5, MAX_SIZE);
    let a: number[];
    if (target === 'all-equal') {
      const v = rng.int(MIN_VALUE, MAX_VALUE);
      a = Array.from({ length: n }, () => v);
    } else if (target === 'distinct') {
      a = rng.shuffle(Array.from({ length: MAX_VALUE - MIN_VALUE + 1 }, (_, i) => MIN_VALUE + i)).slice(0, n);
    } else if (target === 'duplicates') {
      const base = Array.from({ length: Math.max(2, Math.floor(n / 2)) }, () => rng.int(MIN_VALUE, MAX_VALUE));
      a = Array.from({ length: n }, () => rng.pick(base));
      if (new Set(a).size === a.length) continue;
    } else {
      a = Array.from({ length: n }, () => rng.int(MIN_VALUE, MAX_VALUE));
    }
    if (target === 'sorted') a.sort((p, q) => p - q);
    if (target === 'reverse') a.sort((p, q) => q - p);
    return { a };
  }
  const id = target === 'sorted' ? 'sorted' : target === 'reverse' ? 'reverse' : target === 'all-equal' ? 'all-equal' : target === 'duplicates' ? 'duplicates' : 'random';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<QuickSortInput>);
  return structuredClone(fallback.input);
}
