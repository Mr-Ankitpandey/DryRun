/** Input codec, validation, presets and constrained random inputs for
 *  union-find. URL form: n=8&ops=u0-1,u2-3,f3 (u a-b = union(a, b), f x = find(x)). */

import type { Preset, ValidationResult } from '@/algorithms/types';
import type { Rng } from '@/lib/rng';
import type { UfInput, UfOp } from './model';
import { runOps } from './model';

export const MAX_NODES = 10;
export const MAX_OPS = 12;

const U = (a: number, b: number): UfOp => ({ t: 'u', a, b });
const F = (x: number): UfOp => ({ t: 'f', x });

export const presets: Preset<UfInput>[] = [
  {
    id: 'chain-then-find',
    title: 'Deep tree, then find',
    input: { n: 8, ops: [U(0, 1), U(2, 3), U(0, 2), U(4, 5), U(6, 7), U(4, 6), U(0, 4), F(7)] },
    why: 'Equal ranks meet three times, so 7 ends three levels down; find(7) compresses its path.',
  },
  { id: 'union-by-rank-tie', title: 'Equal ranks', input: { n: 4, ops: [U(1, 0), U(3, 2), U(3, 1), F(2)] }, why: 'Every union joins equal ranks: the smaller id goes on top and its rank grows.' },
  { id: 'already-same-set', title: 'Already in the same set', input: { n: 4, ops: [U(0, 1), U(1, 2), U(2, 0), F(2)] }, why: 'The third union finds one root twice: nothing changes.' },
  { id: 'star', title: 'A star', input: { n: 6, ops: [U(0, 1), U(2, 0), U(0, 3), U(4, 0), U(0, 5)] }, why: 'After the first union 0 outranks every singleton, so each one hangs straight under 0.' },
  { id: 'separate', title: 'Separate sets', input: { n: 6, ops: [U(0, 1), U(2, 3), U(4, 5), F(1), F(3), F(5)] }, why: 'Three pairs never meet: each find stops at its own root.' },
];

const OP_RE = /^(?:u(\d+)-(\d+)|f(\d+))$/;

export function validate(raw: Record<string, string>): ValidationResult<UfInput> {
  const ns = (raw.n ?? '').trim();
  if (!/^\d+$/.test(ns)) return { ok: false, error: `Enter the number of elements n as a whole number from 1 to ${MAX_NODES}.` };
  const n = Number(ns);
  if (n < 1 || n > MAX_NODES) return { ok: false, error: `n must be between 1 and ${MAX_NODES} (got ${n}).` };
  const text = (raw.ops ?? '').trim();
  if (text === '') return { ok: false, error: 'Add at least one operation: u0-1 joins 0 and 1, f2 finds the root of 2.' };
  const ops: UfOp[] = [];
  for (const part of text.split(',')) {
    const p = part.trim();
    const m = OP_RE.exec(p);
    if (!m) return { ok: false, error: `Operations look like u0-1 (union) or f2 (find), separated by commas (got "${p}").` };
    const nums = (m[3] !== undefined ? [m[3]] : [m[1], m[2]]).map(Number);
    const bad = nums.find((v) => v >= n);
    if (bad !== undefined) return { ok: false, error: `${p} uses ${bad}, outside 0–${n - 1}.` };
    ops.push(m[3] !== undefined ? F(Number(m[3])) : U(Number(m[1]), Number(m[2])));
  }
  if (ops.length > MAX_OPS) return { ok: false, error: `Use at most ${MAX_OPS} operations (got ${ops.length}).` };
  return { ok: true, input: { n, ops } };
}

export function encode(input: UfInput): Record<string, string> {
  return { n: String(input.n), ops: input.ops.map((o) => (o.t === 'u' ? `u${o.a}-${o.b}` : `f${o.x}`)).join(',') };
}

export function decode(params: Record<string, string>): UfInput | null {
  const r = validate(params);
  return r.ok ? r.input : null;
}

/** Targets: 'compress' (a find moves a pointer), 'same-set' (a union of two
 *  elements already joined), 'tie' (two roots of equal rank 1 or more meet). */
export function randomInput(rng: Rng, target?: string): UfInput {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = rng.int(4, MAX_NODES);
    const count = rng.int(4, MAX_OPS);
    const ops: UfOp[] = [];
    for (let k = 0; k < count; k++) {
      if (rng.next() < 0.3) ops.push(F(rng.int(0, n - 1)));
      else {
        const a = rng.int(0, n - 1);
        let b = rng.int(0, n - 1);
        if (b === a) b = (a + 1 + rng.int(0, n - 2)) % n;
        ops.push(U(a, b));
      }
    }
    const input: UfInput = { n, ops };
    const { stats } = runOps(input);
    if (target === 'compress' && stats.compressions === 0) continue;
    if (target === 'same-set' && stats.sameSet === 0) continue;
    if (target === 'tie' && !hasRankTie(input)) continue;
    return input;
  }
  const id = target === 'same-set' ? 'already-same-set' : target === 'tie' ? 'union-by-rank-tie' : 'chain-then-find';
  const fallback = presets.find((p) => p.id === id) ?? (presets[0] as Preset<UfInput>);
  return structuredClone(fallback.input);
}

/** Some union joins two roots of equal rank ≥ 1 (the tie rule decides, and a rank reaches 2). */
export function hasRankTie(input: UfInput): boolean {
  const parent = Array.from({ length: input.n }, (_, i) => i);
  const rank = Array.from({ length: input.n }, () => 0);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] as number;
    return x;
  };
  for (const op of input.ops) {
    if (op.t !== 'u') continue;
    let ra = find(op.a);
    let rb = find(op.b);
    if (ra === rb) continue;
    if (rank[ra] === rank[rb] && (rank[ra] as number) >= 1) return true;
    if ((rank[ra] as number) < (rank[rb] as number) || (rank[ra] === rank[rb] && rb < ra)) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    if (rank[ra] === rank[rb]) rank[ra] = (rank[ra] as number) + 1;
  }
  return false;
}
