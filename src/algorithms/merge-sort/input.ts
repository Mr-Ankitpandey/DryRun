/** Input codec, validation, presets and constrained random inputs for merge sort.
 *  URL form: i=5,2,9,1 */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import { encodeIntList } from '@/lib/url';
import type { MergeSortInput } from './generator';

export const MAX_SIZE = 16;
export const MIN_VALUE = 0;
export const MAX_VALUE = 99;

export const presets: Preset<MergeSortInput>[] = [
  { id: 'random', title: 'Random values', input: { a: [6, 2, 8, 4, 9, 1, 7, 3] }, why: 'A balanced run: three levels of halves, each merged back up.' },
  { id: 'odd-length', title: 'Odd length (n = 7)', input: { a: [5, 1, 6, 2, 7, 3, 4] }, why: 'mid rounds down, so the left half is the shorter-or-equal one.' },
  { id: 'duplicates', title: 'Duplicates (stability)', input: { a: [3, 1, 3, 2, 1, 3] }, why: 'Ties take the left front, so equal values keep their input order.' },
  { id: 'sorted', title: 'Already sorted', input: { a: [1, 2, 3, 4, 5, 6, 7, 8] }, why: 'The left run always empties first; the right run is copied as leftovers.' },
  { id: 'reverse', title: 'Reverse sorted', input: { a: [8, 7, 6, 5, 4, 3, 2, 1] }, why: 'The right front always wins; the left run is copied as leftovers.' },
  { id: 'two', title: 'Two elements', input: { a: [9, 4] }, why: 'Two base cases, one compare and one leftover copy.' },
  { id: 'single', title: 'One element', input: { a: [7] }, why: 'hi − lo < 1: the only call returns at once.' },
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

export function validate(raw: Record<string, string>): ValidationResult<MergeSortInput> {
  const r = parseList(raw.i ?? '', MAX_SIZE);
  if (!r.ok) return r;
  return { ok: true, input: { a: r.values } };
}

export function encode(input: MergeSortInput): Record<string, string> {
  return { i: encodeIntList(input.a) };
}

export function decode(params: Record<string, string>): MergeSortInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Targets: 'sorted' | 'reverse' | 'all-equal' | 'duplicates' | 'distinct' | 'odd-length'. */
export function randomInput(rng: Rng, target?: string): MergeSortInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = target === 'odd-length' ? 2 * rng.int(2, Math.floor((MAX_SIZE - 1) / 2)) + 1 : rng.int(5, MAX_SIZE);
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
  const id = target === 'sorted' || target === 'reverse' || target === 'duplicates' || target === 'odd-length' ? target : 'random';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<MergeSortInput>);
  return structuredClone(fallback.input);
}
