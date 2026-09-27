/** Input codec, validation, presets and constrained random inputs for LCS.
 *  URL form: a=ABCBDAB&b=BDCABA (uppercase letters, 0 to 7 each). An empty
 *  string is simply left out of the URL, so a missing a or b reads as empty. */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import type { LcsInput } from './generator';
import { table, walk } from './generator';

export const MAX_LEN = 7;

export const presets: Preset<LcsInput>[] = [
  { id: 'classic', title: 'ABCBDAB and BDCABA', input: { a: 'ABCBDAB', b: 'BDCABA' }, why: 'The textbook pair: several LCS of length 4 exist; up-on-ties picks BCBA.' },
  { id: 'empty-string', title: 'An empty string', input: { a: '', b: 'ABC' }, why: 'With one string empty, only the border exists: the LCS is empty.' },
  { id: 'identical', title: 'Identical strings', input: { a: 'DRYRUN', b: 'DRYRUN' }, why: 'Every diagonal cell matches: the walk runs straight down the diagonal.' },
  { id: 'no-common-letter', title: 'No common letter', input: { a: 'ABC', b: 'XYZ' }, why: 'Nothing ever matches: every cell is max(up, left) = 0.' },
  { id: 'one-letter', title: 'One letter each', input: { a: 'A', b: 'A' }, why: 'One cell: a match on the diagonal, dp[1][1] = 0 + 1.' },
  { id: 'tie-heavy', title: 'Many ties', input: { a: 'ABAB', b: 'BABA' }, why: 'Up and left keep tying: the walk follows the up-on-ties rule to ABA.' },
];

function field(raw: string | undefined, name: 'a' | 'b'): { ok: true; s: string } | { ok: false; error: string } {
  const s = (raw ?? '').trim();
  if (s.length > MAX_LEN) return { ok: false, error: `${name} has ${s.length} letters: use at most ${MAX_LEN}.` };
  if (/^[a-zA-Z]*$/.test(s) && /[a-z]/.test(s)) return { ok: false, error: `Use uppercase letters: write ${name}=${s.toUpperCase()}, not ${name}=${s}.` };
  const bad = /[^A-Z]/.exec(s);
  if (bad) return { ok: false, error: `${name} may only hold the letters A–Z (found "${bad[0]}").` };
  return { ok: true, s };
}

export function validate(raw: Record<string, string>): ValidationResult<LcsInput> {
  const a = field(raw.a, 'a');
  if (!a.ok) return a;
  const b = field(raw.b, 'b');
  if (!b.ok) return b;
  return { ok: true, input: { a: a.s, b: b.s } };
}

export function encode(input: LcsInput): Record<string, string> {
  return { a: input.a, b: input.b };
}

export function decode(params: Record<string, string>): LcsInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Whether the walk meets a mismatch cell where up and left tie. */
export function walkHasTie(input: LcsInput): boolean {
  const dp = table(input);
  return walk(input, dp).cells.some(({ i, j, move }) => move !== 'diagonal' && (dp[i - 1] as number[])[j] === (dp[i] as number[])[j - 1]);
}

/** Targets: 'tie' (the walk meets a tie) | 'long' (LCS of 3+) | 'disjoint' (LCS 0, both non-empty). */
export function randomInput(rng: Rng, target?: string): LcsInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const alphabet = 'ABCDEFGH'.slice(0, rng.int(2, target === 'disjoint' ? 8 : 5));
    const word = (): string => Array.from({ length: rng.int(3, MAX_LEN) }, () => rng.pick(alphabet.split(''))).join('');
    const input: LcsInput = { a: word(), b: word() };
    const len = walk(input).lcs.length;
    if (target === 'tie' && !walkHasTie(input)) continue;
    if (target === 'long' && len < 3) continue;
    if (target === 'disjoint' && len !== 0) continue;
    return input;
  }
  const id = target === 'tie' ? 'tie-heavy' : target === 'disjoint' ? 'no-common-letter' : 'classic';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<LcsInput>);
  return structuredClone(fallback.input);
}
