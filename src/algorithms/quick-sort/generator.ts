/** Quick sort, Lomuto partition. See docs/ALGORITHMS.md §3.
 *  Every quicksort call, including size 0/1 segments, is a visible `call` +
 *  `return` frame (args carry lo and hi for the recursion-tree layout). Inside a
 *  partition: `mark pivot` on a[hi]; regions less [lo, i], ge [i+1, j−1],
 *  unscanned [j, hi−1]; per j one compare step (line 9) and, when a[j] < pivot,
 *  one swap step (line 10; a swap with itself is still shown). The final swap
 *  (line 11) marks the pivot done: it is at its final sorted index.
 *
 *  Elements move, so the generator mirrors the slot → element-id map to answer
 *  pick asks by element id. */

import type { Id, Slot, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Ask, Distractor } from '@/trace/asks';

export interface QuickSortInput {
  a: number[];
}

const A = 'a';
const slot = (i: number): Slot => ({ arr: A, i });

const RULE_SWAP = 'Lomuto swaps a[j] into the < side only when a[j] < pivot; equal elements stay on the ≥ side.';
const RULE_LAND = 'The pivot lands at i + 1: right after the last element that is < pivot.';
const RULE_BASE = 'A segment with fewer than two elements is already sorted: return when lo ≥ hi.';
const RULE_ORDER = 'After partition the left segment [lo, p − 1] is sorted first, then [p + 1, hi], then the call is done.';

const SEG_OPTIONS = (lo: number, p: number, hi: number): [string, string, string] => [`[${lo}, ${p - 1}]`, `[${p + 1}, ${hi}]`, 'done'];

class Ctx {
  a: number[];
  slots: Id[];
  frames = 0;

  constructor(a: number[]) {
    this.a = a.slice();
    this.slots = a.map((_, i) => ids.el(i));
  }

  swap(i: number, j: number): void {
    const vi = this.a[i] as number;
    const vj = this.a[j] as number;
    this.a[i] = vj;
    this.a[j] = vi;
    const si = this.slots[i] as Id;
    const sj = this.slots[j] as Id;
    this.slots[i] = sj;
    this.slots[j] = si;
  }

  at(i: number): Id {
    return this.slots[i] as Id;
  }

  nextFrame(): Id {
    return ids.frame(this.frames++);
  }
}

const range = (lo: number, hi: number): [number, number] | null => (lo <= hi ? [lo, hi] : null);

export function* generate(input: QuickSortInput): Iterable<Step> {
  const ctx = new Ctx(input.a);
  yield* quicksort(ctx, 0, input.a.length - 1, null, null);
}

interface Parent {
  id: Id;
  lo: number;
  hi: number;
  p: number;
}

/** `entry` is the ask placed on this call's entry step (which segment is next). */
function* quicksort(ctx: Ctx, lo: number, hi: number, parent: Parent | null, entry: { line: number; ask: Ask } | null): Iterable<Step> {
  const id = ctx.nextFrame();
  const size = hi - lo + 1;
  const callEvents: VizEvent[] = [
    { t: 'call', id, label: `quicksort(${lo}, ${hi})`, args: { lo, hi }, parent: parent ? parent.id : null },
    { t: 'var', name: 'lo', value: lo },
    { t: 'var', name: 'hi', value: hi },
    { t: 'pointer', name: 'lo', at: slot(lo) },
    { t: 'pointer', name: 'hi', at: slot(hi) },
  ];
  const callStep: Step = {
    line: entry ? entry.line : 1,
    events: callEvents,
    note: `quicksort(${lo}, ${hi}) is called on ${size <= 0 ? 'an empty segment' : size === 1 ? 'one element' : `${size} elements`}.`,
    phase: 'call',
  };
  if (entry) callStep.ask = entry.ask;
  yield callStep;

  const recurse = lo < hi;
  const decision: Ask = {
    kind: 'choice',
    level: 'full',
    prompt: `quicksort(${lo}, ${hi}): recurse or return?`,
    options: ['Recurse: lo < hi', 'Return: lo ≥ hi'],
    answer: recurse ? 'Recurse: lo < hi' : 'Return: lo ≥ hi',
    rule: RULE_BASE,
    distractors: [{ answer: recurse ? 'Return: lo ≥ hi' : 'Recurse: lo < hi', kind: 'base-case', rule: RULE_BASE }],
  };
  if (!recurse) {
    const events: VizEvent[] = [];
    if (size === 1) events.push({ t: 'mark', ref: { id: ctx.at(lo) }, as: 'done' });
    events.push({ t: 'return', id }, ...restore(parent));
    yield {
      line: 2,
      events,
      note: size === 1 ? `lo = hi = ${lo}: one element is already in place, return.` : `lo = ${lo} > hi = ${hi}: the segment is empty, return.`,
      phase: 'call',
      ask: decision,
    };
    return;
  }
  yield { line: 2, events: [], note: `lo = ${lo} < hi = ${hi}: partition the segment around a[${hi}].`, phase: 'call', ask: decision };

  const p = yield* partition(ctx, lo, hi);

  const me: Parent = { id, lo, hi, p };
  const [left, right, done] = SEG_OPTIONS(lo, p, hi);
  const segAsk = (answer: string): Ask => ({
    kind: 'choice',
    level: 'guided',
    prompt: `quicksort(${lo}, ${hi}) has p = ${p}. Which segment is sorted next?`,
    options: [left, right, done],
    answer,
    rule: RULE_ORDER,
    distractors: [left, right, done].filter((o) => o !== answer).map((o) => ({ answer: o, kind: o === done || answer === done ? 'base-case' : 'order', rule: RULE_ORDER })),
  });
  yield* quicksort(ctx, lo, p - 1, me, { line: 4, ask: segAsk(left) });
  yield* quicksort(ctx, p + 1, hi, me, { line: 5, ask: segAsk(right) });
  yield {
    line: 5,
    events: [{ t: 'return', id }, ...restore(parent)],
    note: `Both sides of p = ${p} are sorted: quicksort(${lo}, ${hi}) returns.`,
    phase: 'call',
    ask: segAsk(done),
  };
}

/** Events that put lo/hi back on the caller's segment after a return. */
function restore(parent: Parent | null): VizEvent[] {
  if (!parent) return [{ t: 'pointer', name: 'lo', at: null }, { t: 'pointer', name: 'hi', at: null }];
  return [
    { t: 'var', name: 'lo', value: parent.lo },
    { t: 'var', name: 'hi', value: parent.hi },
    { t: 'pointer', name: 'lo', at: slot(parent.lo) },
    { t: 'pointer', name: 'hi', at: slot(parent.hi) },
  ];
}

function* partition(ctx: Ctx, lo: number, hi: number): Generator<Step, number, undefined> {
  const pivotId = ctx.at(hi);
  const pivot = ctx.a[hi] as number;
  let i = lo - 1;

  yield {
    line: 7,
    events: [
      { t: 'var', name: 'phase', value: 'partition' },
      { t: 'mark', ref: { id: pivotId }, as: 'pivot' },
      { t: 'var', name: 'pivot', value: pivot },
      { t: 'var', name: 'i', value: i },
      { t: 'var', name: 'j', value: lo },
      { t: 'pointer', name: 'i', at: slot(i) },
      { t: 'pointer', name: 'j', at: slot(lo) },
      { t: 'region', name: 'less', kind: 'less', arr: A, range: null },
      { t: 'region', name: 'ge', kind: 'greaterEq', arr: A, range: null },
      { t: 'region', name: 'unscanned', kind: 'unscanned', arr: A, range: range(lo, hi - 1) },
    ],
    note: `pivot = a[${hi}] = ${pivot}; i = ${i}: nothing is known to be < pivot yet.`,
    phase: 'partition',
  };

  for (let j = lo; j <= hi - 1; j++) {
    const v = ctx.a[j] as number;
    const less = v < pivot;
    const cmp: VizEvent[] = [
      { t: 'pointer', name: 'j', at: slot(j) },
      { t: 'var', name: 'j', value: j },
      { t: 'compare', a: slot(j), b: slot(hi), result: v < pivot ? '<' : v === pivot ? '=' : '>' },
    ];
    if (!less) {
      cmp.push({ t: 'region', name: 'ge', kind: 'greaterEq', arr: A, range: range(i + 1, j) });
      cmp.push({ t: 'region', name: 'unscanned', kind: 'unscanned', arr: A, range: range(j + 1, hi - 1) });
    }
    yield {
      line: 9,
      events: cmp,
      note: less ? `a[${j}] = ${v} < pivot ${pivot}: it belongs on the < side, so i moves up and a[i], a[j] swap.` : `a[${j}] = ${v} ≥ pivot ${pivot}: it stays on the ≥ side and i does not move.`,
      phase: 'partition',
      ask: {
        kind: 'choice',
        level: 'full',
        prompt: `a[${j}] = ${v}, pivot = ${pivot}. Does a[${j}] swap with a[i + 1] = a[${i + 1}]?`,
        options: ['yes', 'no'],
        answer: less ? 'yes' : 'no',
        rule: RULE_SWAP,
        distractors: [{ answer: less ? 'no' : 'yes', kind: 'comparison', rule: RULE_SWAP }],
      },
    };
    if (!less) continue;

    i++;
    const self = i === j;
    ctx.swap(i, j);
    yield {
      line: 10,
      events: [
        { t: 'var', name: 'i', value: i },
        { t: 'pointer', name: 'i', at: slot(i) },
        { t: 'swap', a: slot(i), b: slot(j) },
        { t: 'region', name: 'less', kind: 'less', arr: A, range: range(lo, i) },
        { t: 'region', name: 'ge', kind: 'greaterEq', arr: A, range: range(i + 1, j) },
        { t: 'region', name: 'unscanned', kind: 'unscanned', arr: A, range: range(j + 1, hi - 1) },
      ],
      note: self ? `i = ${i} = j: a[${j}] swaps with itself and the < side grows to [${lo}, ${i}].` : `i = ${i}: a[${i}] and a[${j}] swap, so the < side grows to [${lo}, ${i}].`,
      phase: 'partition',
    };
  }

  const p = i + 1;
  const candidates: Id[] = [];
  for (let k = lo; k <= hi; k++) candidates.push(ctx.at(k));
  const landAnswer = ctx.at(p);
  const distractors: Distractor<Id>[] = [];
  if (i >= lo) distractors.push({ answer: ctx.at(i), kind: 'boundary', rule: RULE_LAND });
  const mid = lo + Math.floor((hi - lo) / 2);
  if (mid !== p && mid !== i) distractors.push({ answer: ctx.at(mid), kind: 'unclassified', rule: 'The pivot lands at i + 1, not in the middle of the segment.' });
  ctx.swap(p, hi);
  yield {
    line: 11,
    events: [
      { t: 'swap', a: slot(p), b: slot(hi) },
      { t: 'mark', ref: { id: pivotId }, as: 'done' },
      { t: 'pointer', name: 'j', at: slot(hi) },
      { t: 'var', name: 'j', value: hi },
      { t: 'region', name: 'less', kind: 'less', arr: A, range: range(lo, i) },
      { t: 'region', name: 'ge', kind: 'greaterEq', arr: A, range: range(p + 1, hi) },
      { t: 'region', name: 'unscanned', kind: 'unscanned', arr: A, range: null },
    ],
    note: p === hi ? `i + 1 = ${p} = hi: the pivot ${pivot} swaps with itself and is settled at index ${p}.` : `Swap a[${p}] and a[${hi}]: the pivot ${pivot} is settled at index ${p}.`,
    phase: 'partition',
    ask: {
      kind: 'pick',
      level: 'guided',
      prompt: `The scan ends with i = ${i}. Where does the pivot ${pivot} land?`,
      answer: landAnswer,
      candidates,
      rule: RULE_LAND,
      distractors,
    },
  };

  yield {
    line: 12,
    events: [
      { t: 'var', name: 'p', value: p },
      { t: 'var', name: 'phase', value: null },
      { t: 'pointer', name: 'i', at: null },
      { t: 'pointer', name: 'j', at: null },
      { t: 'region', name: 'less', kind: 'less', arr: A, range: null },
      { t: 'region', name: 'ge', kind: 'greaterEq', arr: A, range: null },
    ],
    note: `partition returns p = ${p}: everything left of p is < ${pivot}, everything right is ≥ ${pivot}.`,
    phase: 'partition',
  };
  return p;
}
