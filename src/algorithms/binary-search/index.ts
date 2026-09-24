import type { AlgorithmModule } from '@/algorithms/types';
import type { State } from '@/engine/state';
import { withArray, emptyState } from '@/engine/state';
import type { BinarySearchInput } from './generator';
import { generate } from './generator';
import { MAX_SIZE, decode, encode, presets, randomInput, validate } from './input';

export type { BinarySearchInput } from './generator';

export const pseudocode: Record<string, string[]> = {
  classic: [
    'lo = 0, hi = n - 1',
    'while lo <= hi:',
    '    mid = lo + (hi - lo) / 2',
    '    if a[mid] == x: return mid',
    '    else if a[mid] < x: lo = mid + 1',
    '    else: hi = mid - 1',
    'return -1',
  ],
  lower: ['lo = 0, hi = n', 'while lo < hi:', '    mid = lo + (hi - lo) / 2', '    if a[mid] < x: lo = mid + 1', '    else: hi = mid', 'return lo'],
};

/** Plain implementations used by tests. */
export function reference(input: BinarySearchInput): number {
  const { a, x } = input;
  if (input.variant === 'lower') {
    let lo = 0;
    let hi = a.length;
    while (lo < hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if ((a[mid] as number) < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  let lo = 0;
  let hi = a.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const v = a[mid] as number;
    if (v === x) return mid;
    if (v < x) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

function invariantCheck(state: State, input: BinarySearchInput): string | null {
  const lo = state.vars.lo;
  const hi = state.vars.hi;
  if (typeof lo !== 'number' || typeof hi !== 'number') return null; // before setup
  const { a, x } = input;
  if (input.variant === 'lower') {
    const ans = reference(input);
    if (ans < lo || ans > hi) return `lower bound ${ans} left [lo=${lo}, hi=${hi}]`;
    return null;
  }
  if (typeof state.vars.result === 'number') return null; // finished
  const present = a.includes(x);
  if (!present) return null;
  for (let i = Math.max(0, lo); i <= Math.min(hi, a.length - 1); i++) if (a[i] === x) return null;
  return `x=${x} is present but not inside [lo=${lo}, hi=${hi}]`;
}

export const binarySearch: AlgorithmModule<BinarySearchInput> = {
  meta: {
    id: 'binary-search',
    title: 'Binary search',
    family: 'search',
    renderers: ['array'],
    panels: ['vars'],
    tieBreak: 'mid rounds down; with duplicates, classic returns whichever copy mid hits first.',
    minutes: 3,
    caps: { maxSteps: 60, maxSize: MAX_SIZE },
    variants: [
      { id: 'classic', title: 'Classic' },
      { id: 'lower', title: 'Lower bound' },
    ],
  },
  pseudocode,
  invariant: {
    classic: { name: 'Search range', sentence: 'If x is present, it is inside [lo, hi].' },
    lower: { name: 'Search range', sentence: 'The first index with a[i] ≥ x is inside [lo, hi].' },
  },
  initialState: (input) => withArray(emptyState(), 'a', input.a),
  generate,
  reference,
  result: (final) => (typeof final.vars.result === 'number' ? final.vars.result : null),
  invariantCheck,
  presets,
  randomInput,
  validate,
  encode,
  decode,
  variantOf: (input) => input.variant,
};
