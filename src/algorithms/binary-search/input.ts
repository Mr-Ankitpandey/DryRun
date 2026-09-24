/** Input codec, validation, presets and constrained random inputs. */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import { decodeIntList, encodeIntList } from '@/lib/url';
import type { BinarySearchInput, Variant } from './generator';

export const MAX_SIZE = 16;
export const MIN_VALUE = 0;
export const MAX_VALUE = 99;

export const presets: Preset<BinarySearchInput>[] = [
  { id: 'basic', title: 'Present, middle of the array', input: { a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 42, variant: 'classic' }, why: 'Three halvings, one direction change.' },
  { id: 'absent', title: 'Target absent', input: { a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 20, variant: 'classic' }, why: 'The range shrinks to empty and −1 is returned.' },
  { id: 'first', title: 'Target is the first element', input: { a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 3, variant: 'classic' }, why: 'hi keeps moving left until mid = 0.' },
  { id: 'last', title: 'Target is the last element', input: { a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 51, variant: 'classic' }, why: 'lo keeps moving right; watch mid rounding.' },
  { id: 'empty', title: 'Empty array', input: { a: [], x: 5, variant: 'classic' }, why: 'hi = −1 before the loop: it never runs.' },
  { id: 'single-hit', title: 'One element, present', input: { a: [7], x: 7, variant: 'classic' }, why: 'lo = hi = mid = 0 and the loop body runs once.' },
  { id: 'single-miss', title: 'One element, absent', input: { a: [7], x: 3, variant: 'classic' }, why: 'hi becomes −1 after one step.' },
  { id: 'duplicates-lower', title: 'Duplicates, lower bound', input: { a: [1, 2, 2, 2, 3, 5], x: 2, variant: 'lower' }, why: 'Lower bound lands on the first 2, index 1.' },
  { id: 'all-equal-lower', title: 'All equal, lower bound', input: { a: [4, 4, 4, 4, 4], x: 4, variant: 'lower' }, why: 'hi = mid keeps shrinking to index 0.' },
  { id: 'lower-absent', title: 'Lower bound, absent value', input: { a: [1, 3, 5, 7], x: 4, variant: 'lower' }, why: 'Returns the insertion point 2.' },
  { id: 'lower-beyond', title: 'Lower bound, larger than all', input: { a: [1, 3, 5, 7], x: 9, variant: 'lower' }, why: 'Returns n = 4, one past the end.' },
];

export function validate(raw: Record<string, string>): ValidationResult<BinarySearchInput> {
  const a = decodeIntList(raw.i ?? '', { min: MIN_VALUE, max: MAX_VALUE, maxLen: MAX_SIZE });
  if (a === null) return { ok: false, error: `Enter up to ${MAX_SIZE} whole numbers between ${MIN_VALUE} and ${MAX_VALUE}, separated by commas.` };
  for (let i = 1; i < a.length; i++) {
    if ((a[i] as number) < (a[i - 1] as number)) return { ok: false, error: `Binary search needs a sorted array: ${a[i - 1]} comes before ${a[i]}.` };
  }
  const xs = (raw.x ?? '').trim();
  if (!/^-?\d+$/.test(xs)) return { ok: false, error: 'Enter a whole number to search for.' };
  const x = Number(xs);
  if (x < MIN_VALUE || x > MAX_VALUE) return { ok: false, error: `The target must be between ${MIN_VALUE} and ${MAX_VALUE}.` };
  const variant: Variant = raw.v === 'lower' ? 'lower' : 'classic';
  return { ok: true, input: { a, x, variant } };
}

export function encode(input: BinarySearchInput): Record<string, string> {
  return { i: encodeIntList(input.a), x: String(input.x), v: input.variant };
}

export function decode(params: Record<string, string>): BinarySearchInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Targets: 'classic' | 'lower' | 'present' | 'absent' | 'duplicates'. */
export function randomInput(rng: Rng, target?: string): BinarySearchInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = rng.int(5, MAX_SIZE);
    const withDups = target === 'duplicates' || rng.next() < 0.3;
    const values: number[] = [];
    for (let i = 0; i < n; i++) values.push(rng.int(MIN_VALUE, MAX_VALUE));
    let a = values.sort((p, q) => p - q);
    if (!withDups) a = Array.from(new Set(a));
    const wantPresent = target === 'present' ? true : target === 'absent' ? false : rng.next() < 0.6;
    let x: number;
    if (wantPresent) x = rng.pick(a);
    else {
      const set = new Set(a);
      const candidates: number[] = [];
      for (let v = MIN_VALUE; v <= MAX_VALUE; v++) if (!set.has(v)) candidates.push(v);
      if (candidates.length === 0) continue;
      x = rng.pick(candidates);
    }
    const variant: Variant = target === 'lower' ? 'lower' : target === 'classic' ? 'classic' : rng.next() < 0.6 ? 'classic' : 'lower';
    if (target === 'duplicates' && new Set(a).size === a.length) continue;
    return { a, x, variant };
  }
  const fallback = presets.find((p) => p.id === (target === 'lower' || target === 'duplicates' ? 'duplicates-lower' : 'basic'));
  return structuredClone((fallback ?? (presets[0] as Preset<BinarySearchInput>)).input);
}
