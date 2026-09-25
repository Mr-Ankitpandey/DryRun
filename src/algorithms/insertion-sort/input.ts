/** Input codec, validation, presets and constrained random inputs for insertion sort.
 *  URL form: i=5,2,9,1 */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import { encodeIntList } from '@/lib/url';
import type { InsertionSortInput } from './generator';

export const MAX_SIZE = 12;
export const MIN_VALUE = 0;
export const MAX_VALUE = 99;

export const presets: Preset<InsertionSortInput>[] = [
  { id: 'random', title: 'Random values', input: { a: [5, 2, 9, 1, 7, 3] }, why: 'A typical run: some keys slide far, some barely move.' },
  { id: 'sorted', title: 'Already sorted (0 shifts)', input: { a: [1, 3, 4, 6, 8, 9] }, why: 'Every key stops at once: one compare per pass and no shifts.' },
  { id: 'reverse', title: 'Reverse sorted (most shifts)', input: { a: [9, 8, 6, 4, 3, 1] }, why: 'Every key slides to the front: the worst case, i shifts in pass i.' },
  { id: 'duplicates', title: 'Duplicates (stability)', input: { a: [4, 2, 4, 1, 2, 3] }, why: 'An equal a[j] stops the key, so equal values keep their input order.' },
  { id: 'all-equal', title: 'All equal', input: { a: [3, 3, 3, 3, 3] }, why: 'a[j] > key is never true: nothing shifts, and the order is kept.' },
  { id: 'single', title: 'One element', input: { a: [7] }, why: 'A single element is already sorted: the loop never runs.' },
  { id: 'empty', title: 'Empty array', input: { a: [] }, why: 'n = 0: there is nothing to insert.' },
];

/** Parses a comma-separated list with an error that names the offending entry. */
export function parseList(raw: string, max: number): { ok: true; values: number[] } | { ok: false; error: string } {
  const s = raw.trim();
  if (s === '') return { ok: true, values: [] };
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length > max) return { ok: false, error: `Use at most ${max} numbers (got ${parts.length}).` };
  const values: number[] = [];
  for (const p of parts) {
    if (!/^-?\d+$/.test(p)) return { ok: false, error: `"${p}" is not a whole number: separate whole numbers with commas.` };
    const v = Number(p);
    if (v < MIN_VALUE || v > MAX_VALUE) return { ok: false, error: `${v} is out of range: use values from ${MIN_VALUE} to ${MAX_VALUE}.` };
    values.push(v);
  }
  return { ok: true, values };
}

export function validate(raw: Record<string, string>): ValidationResult<InsertionSortInput> {
  const r = parseList(raw.i ?? '', MAX_SIZE);
  if (!r.ok) return r;
  return { ok: true, input: { a: r.values } };
}

export function encode(input: InsertionSortInput): Record<string, string> {
  return { i: encodeIntList(input.a) };
}

export function decode(params: Record<string, string>): InsertionSortInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Targets: 'sorted' | 'reverse' | 'all-equal' | 'duplicates' | 'distinct'. */
export function randomInput(rng: Rng, target?: string): InsertionSortInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = rng.int(5, MAX_SIZE);
    let a: number[];
    if (target === 'all-equal') {
      const v = rng.int(MIN_VALUE, MAX_VALUE);
      a = Array.from({ length: n }, () => v);
    } else if (target === 'distinct' || target === 'sorted' || target === 'reverse') {
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
  const id = target === 'sorted' || target === 'reverse' || target === 'all-equal' || target === 'duplicates' ? target : 'random';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<InsertionSortInput>);
  return structuredClone(fallback.input);
}
