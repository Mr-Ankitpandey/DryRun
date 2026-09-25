/** Merge sort, top-down and stable. See docs/ALGORITHMS.md §4.
 *  Every call, including size-1 segments, is a visible `call` + `return` frame
 *  (args carry lo, hi and, for segments of two or more, mid). The aux array is
 *  declared once, on the first step. Step rhythm of one merge:
 *    init (line 7: carets i, j on 'a' and k on 'aux') →
 *    per copy while both runs have elements: `compare` a[i] with a[j] and `move`
 *    the smaller front into aux[k], left first on ties (line 9 or 10) →
 *    loop exit (line 8: one run is used up) →
 *    each leftover element is its own copy step (line 11) →
 *    copy-back (line 12): ONE step of `move`s aux[lo..hi] → a[lo..hi], region
 *    `sorted:<lo>` grows to [lo, hi] and the right child's region is cleared.
 *  Identity travels: the element that was at a[i] is the one that lands in aux[k]
 *  and the one that is written back. */

import type { Id, Slot, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Ask, Distractor } from '@/trace/asks';

export interface MergeSortInput {
  a: number[];
}

export const A = 'a';
export const AUX = 'aux';
const inA = (i: number): Slot => ({ arr: A, i });
const inAux = (i: number): Slot => ({ arr: AUX, i });
export const regionName = (lo: number): string => `sorted:${lo}`;

const RULE_COPY = 'Both runs are sorted: copy the smaller front, and the left one on ties.';
const RULE_SMALLER = 'The smaller of the two fronts is copied next.';
const RULE_TIE = 'Left first on ties: taking the left copy keeps equal values in input order.';
const RULE_RETURN = 'Calls return in reverse order: the most recent open call returns first.';
const RULE_LEFT = 'The left run still holds a[i..mid]: that is mid − i + 1 elements.';

export const callLabel = (lo: number, hi: number): string => `mergesort(${lo}, ${hi})`;

class Ctx {
  /** Mirrors of the engine arrays: element id per slot (null = empty) and values. */
  a: (Id | null)[];
  aux: (Id | null)[];
  value: Record<Id, number> = {};
  frames = 0;
  /** Open frames, bottom first (labels), mirrored for the return ask. */
  open: string[] = [];
  regions = new Set<string>();

  constructor(values: readonly number[]) {
    this.a = values.map((v, i) => {
      const id = ids.el(i);
      this.value[id] = v;
      return id;
    });
    this.aux = values.map(() => null);
  }

  val(id: Id | null): number {
    if (id === null) throw new Error('merge sort: empty slot read');
    return this.value[id] as number;
  }

  nextFrame(): Id {
    return ids.frame(this.frames++);
  }
}

export function* generate(input: MergeSortInput): Iterable<Step> {
  const ctx = new Ctx(input.a);
  yield* mergesort(ctx, 0, input.a.length - 1, null);
}

function returnAsk(ctx: Ctx): Ask | undefined {
  if (ctx.open.length < 2) return undefined;
  const answer = ctx.open[ctx.open.length - 1] as string;
  const options = ctx.open.slice();
  return {
    kind: 'choice',
    level: 'full',
    prompt: 'Which call returns next?',
    options,
    answer,
    rule: RULE_RETURN,
    distractors: options.filter((o) => o !== answer).map((o) => ({ answer: o, kind: 'order' as const, rule: RULE_RETURN })),
  };
}

function* mergesort(ctx: Ctx, lo: number, hi: number, parent: Id | null): Iterable<Step> {
  const id = ctx.nextFrame();
  const size = hi - lo + 1;
  const mid = lo + Math.floor((hi - lo) / 2);
  const events: VizEvent[] = [];
  if (parent === null && size >= 2) events.push({ t: 'array', name: AUX, size });
  events.push({ t: 'call', id, label: callLabel(lo, hi), args: size >= 2 ? { lo, hi, mid } : { lo, hi }, parent });
  ctx.open.push(callLabel(lo, hi));
  yield {
    line: parent === null ? 1 : 4,
    events,
    note: `${callLabel(lo, hi)} is called on ${size <= 0 ? 'an empty segment' : size === 1 ? 'one element' : `${size} elements`}.`,
    phase: 'call',
  };

  if (size < 2) {
    const ask = returnAsk(ctx);
    ctx.open.pop();
    const step: Step = {
      line: 2,
      events: [{ t: 'return', id }],
      note: size === 1 ? `lo = hi = ${lo}: one element is already a sorted run, so return.` : 'The segment is empty: nothing to sort, so return.',
      phase: 'call',
    };
    if (ask) step.ask = ask;
    yield step;
    return;
  }

  yield {
    line: 3,
    events: [],
    note: `mid = ${lo} + (${hi} − ${lo}) / 2 = ${mid}: sort [${lo}, ${mid}], then [${mid + 1}, ${hi}].`,
    phase: 'call',
  };
  yield* mergesort(ctx, lo, mid, id);
  yield* mergesort(ctx, mid + 1, hi, id);
  yield* merge(ctx, lo, mid, hi);

  const ask = returnAsk(ctx);
  ctx.open.pop();
  const step: Step = { line: 5, events: [{ t: 'return', id }], note: `${callLabel(lo, hi)} returns: a[${lo}..${hi}] is one sorted run.`, phase: 'call' };
  if (ask) step.ask = ask;
  yield step;
}

function* merge(ctx: Ctx, lo: number, mid: number, hi: number): Iterable<Step> {
  let i = lo;
  let j = mid + 1;
  let k = lo;
  const carets = (): VizEvent[] => [
    { t: 'pointer', name: 'i', at: inA(i) },
    { t: 'pointer', name: 'j', at: inA(j) },
    { t: 'pointer', name: 'k', at: inAux(k) },
  ];
  yield {
    line: 7,
    events: carets(),
    note: `Merge [${lo}, ${mid}] with [${mid + 1}, ${hi}]: i = ${lo}, j = ${mid + 1}, k = ${lo}.`,
    phase: 'merge',
  };

  const copy = (from: number): Id => {
    const el = ctx.a[from] as Id;
    ctx.a[from] = null;
    ctx.aux[k] = el;
    return el;
  };

  while (i <= mid && j <= hi) {
    const left = ctx.a[i] as Id;
    const right = ctx.a[j] as Id;
    const vi = ctx.val(left);
    const vj = ctx.val(right);
    const takeLeft = vi <= vj;
    const candidates: Id[] = [];
    for (let s = lo; s <= hi; s++) {
      const x = ctx.a[s];
      if (x !== null && x !== undefined) candidates.push(x);
    }
    const answer = takeLeft ? left : right;
    const other = takeLeft ? right : left;
    const distractors: Distractor<Id>[] = [vi === vj ? { answer: other, kind: 'order', rule: RULE_TIE } : { answer: other, kind: 'comparison', rule: RULE_SMALLER }];
    const at = k;
    const el = copy(takeLeft ? i : j);
    if (takeLeft) i++;
    else j++;
    k++;
    yield {
      line: takeLeft ? 9 : 10,
      events: [{ t: 'compare', a: { id: left }, b: { id: right }, result: vi < vj ? '<' : vi === vj ? '=' : '>' }, { t: 'move', id: el, to: inAux(at) }, ...carets()],
      note:
        vi === vj
          ? `a[i] = a[j] = ${vi}: ties take the left one, so the left ${vi} goes to aux[${at}].`
          : takeLeft
            ? `a[i] = ${vi} < a[j] = ${vj}: the left front ${vi} goes to aux[${at}].`
            : `a[j] = ${vj} < a[i] = ${vi}: the right front ${vj} goes to aux[${at}].`,
      phase: 'merge',
      ask: { kind: 'pick', level: 'guided', prompt: 'Which element is copied next?', answer, candidates, rule: RULE_COPY, distractors },
    };
  }

  const leftLeft = mid - i + 1;
  const distractors: Distractor<number>[] = [{ answer: leftLeft + 1, kind: 'boundary', rule: RULE_LEFT }];
  if (leftLeft >= 1) distractors.push({ answer: leftLeft - 1, kind: 'boundary', rule: RULE_LEFT });
  yield {
    line: 8,
    events: [],
    note: i > mid ? 'i passes mid: the left run is used up, so the rest of the right run follows.' : 'j passes hi: the right run is used up, so the rest of the left run follows.',
    phase: 'merge',
    ask: { kind: 'value', level: 'full', prompt: 'One run is used up. How many elements remain in the left run?', answer: leftLeft, rule: RULE_LEFT, distractors },
  };

  while (i <= mid || j <= hi) {
    const fromLeft = i <= mid;
    const at = k;
    const el = copy(fromLeft ? i : j);
    const v = ctx.val(el);
    if (fromLeft) i++;
    else j++;
    k++;
    yield {
      line: 11,
      events: [{ t: 'move', id: el, to: inAux(at) }, ...carets()],
      note: `${v} is left over in the ${fromLeft ? 'left' : 'right'} run and is copied to aux[${at}].`,
      phase: 'merge',
    };
  }

  const back: VizEvent[] = [];
  for (let s = lo; s <= hi; s++) {
    const el = ctx.aux[s] as Id;
    ctx.aux[s] = null;
    ctx.a[s] = el;
    back.push({ t: 'move', id: el, to: inA(s) });
  }
  back.push({ t: 'region', name: regionName(lo), kind: 'sorted', arr: A, range: [lo, hi] });
  ctx.regions.add(regionName(lo));
  if (ctx.regions.has(regionName(mid + 1))) {
    back.push({ t: 'region', name: regionName(mid + 1), kind: 'sorted', arr: A, range: null });
    ctx.regions.delete(regionName(mid + 1));
  }
  back.push({ t: 'pointer', name: 'i', at: null }, { t: 'pointer', name: 'j', at: null }, { t: 'pointer', name: 'k', at: null });
  yield {
    line: 12,
    events: back,
    note: `aux[${lo}..${hi}] is written back: a[${lo}..${hi}] is now one sorted run.`,
    phase: 'merge',
  };
}
