/** Input codec, validation, presets and constrained random inputs for 0/1 knapsack.
 *  URL form: w=2,3,4&v=3,4,5&W=7 (item i has weight w[i−1] and value v[i−1]). */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import type { KnapsackInput } from './generator';
import { table } from './generator';

export const MAX_ITEMS = 5;
export const MAX_CAPACITY = 10;
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 6;
export const MIN_VALUE = 1;
export const MAX_VALUE = 20;

export const presets: Preset<KnapsackInput>[] = [
  { id: 'classic', title: 'Four items, capacity 7', input: { w: [1, 3, 4, 5], v: [1, 4, 5, 7], W: 7 }, why: 'The heaviest item is not in the answer: items 2 and 3 fill the bag exactly for 9.' },
  { id: 'zero-capacity', title: 'Capacity 0', input: { w: [2, 3], v: [3, 4], W: 0 }, why: 'Nothing ever fits: every cell copies the zero above.' },
  { id: 'one-item', title: 'One item', input: { w: [3], v: [5], W: 5 }, why: 'Left of w the row copies 0; from c = w on, taking the item wins.' },
  { id: 'item-too-heavy', title: 'An item that never fits', input: { w: [6, 2], v: [20, 3], W: 5 }, why: 'Item 1 is worth the most but weighs more than the bag: its row is all copies.' },
  { id: 'tie', title: 'Two optimal subsets', input: { w: [1, 2, 3], v: [1, 2, 3], W: 3 }, why: 'Item 3 alone and items 1 + 2 both give 3: the tie reads as skip, so 1 and 2 are taken.' },
  { id: 'all-fit', title: 'Everything fits', input: { w: [1, 2, 3], v: [4, 5, 6], W: 10 }, why: 'The bag holds every item: the last cell takes all three.' },
];

const plural = (k: number, word: string): string => `${k} ${word}${k === 1 ? '' : 's'}`;

function list(raw: string | undefined, name: string, what: string, min: number, max: number): { ok: true; values: number[] } | { ok: false; error: string } {
  const s = (raw ?? '').trim();
  if (s === '') return { ok: false, error: `Enter the item ${what}s as ${name}=…, whole numbers separated by commas.` };
  const values: number[] = [];
  for (const p of s.split(',').map((x) => x.trim())) {
    if (!/^-?\d+$/.test(p)) return { ok: false, error: `"${p}" is not a whole number: item ${what}s are whole numbers separated by commas.` };
    const x = Number(p);
    if (x < min || x > max) return { ok: false, error: `A ${what} of ${x} is out of range: use ${what}s from ${min} to ${max}.` };
    values.push(x);
  }
  return { ok: true, values };
}

export function validate(raw: Record<string, string>): ValidationResult<KnapsackInput> {
  const w = list(raw.w, 'w', 'weight', MIN_WEIGHT, MAX_WEIGHT);
  if (!w.ok) return w;
  const v = list(raw.v, 'v', 'value', MIN_VALUE, MAX_VALUE);
  if (!v.ok) return v;
  if (w.values.length > MAX_ITEMS) return { ok: false, error: `Use at most ${MAX_ITEMS} items (got ${w.values.length}).` };
  if (w.values.length !== v.values.length) return { ok: false, error: `Give one value per weight: ${plural(w.values.length, 'weight')} but ${plural(v.values.length, 'value')}.` };
  const Ws = (raw.W ?? '').trim();
  if (!/^\d+$/.test(Ws)) return { ok: false, error: `Enter the capacity W as a whole number from 0 to ${MAX_CAPACITY}.` };
  const W = Number(Ws);
  if (W > MAX_CAPACITY) return { ok: false, error: `The capacity W must be at most ${MAX_CAPACITY} (got ${W}).` };
  return { ok: true, input: { w: w.values, v: v.values, W } };
}

export function encode(input: KnapsackInput): Record<string, string> {
  return { w: input.w.join(','), v: input.v.join(','), W: String(input.W) };
}

export function decode(params: Record<string, string>): KnapsackInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Whether the reconstruction walk meets a cell where taking and skipping tie
 *  (two optimal choices; the skip rule decides). */
export function hasTie(input: KnapsackInput): boolean {
  const dp = table(input);
  let c = input.W;
  for (let i = input.w.length; i >= 1; i--) {
    const w = input.w[i - 1] as number;
    const up = dp[i - 1] as number[];
    if (w <= c && (up[c - w] as number) + (input.v[i - 1] as number) === up[c]) return true;
    if ((dp[i] as number[])[c] !== up[c]) c -= w;
  }
  return false;
}

/** Targets: 'tie' | 'all-fit' (total weight ≤ W) | 'partial' (total weight > W: not every item fits). */
export function randomInput(rng: Rng, target?: string): KnapsackInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = rng.int(2, MAX_ITEMS);
    const w = Array.from({ length: n }, () => rng.int(MIN_WEIGHT, MAX_WEIGHT));
    const v = Array.from({ length: n }, () => rng.int(MIN_VALUE, MAX_VALUE));
    const W = rng.int(3, MAX_CAPACITY);
    const input: KnapsackInput = { w, v, W };
    const total = w.reduce((s, x) => s + x, 0);
    if (target === 'tie' && !hasTie(input)) continue;
    if (target === 'all-fit' && total > W) continue;
    if (target === 'partial' && total <= W) continue;
    return input;
  }
  const id = target === 'tie' ? 'tie' : target === 'all-fit' ? 'all-fit' : 'classic';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<KnapsackInput>);
  return structuredClone(fallback.input);
}
