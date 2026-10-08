/** Binary min-heap: insert (sift-up), extract-min (sift-down from the root)
 *  and bottom-up build-heap. The heap lives in array 'a' only; the stage also
 *  draws 'a' as its implicit tree (`array.tree`, declared by initialState), so
 *  every swap below moves the same element in the array and in the tree.
 *
 *  Step rhythm of one sift-down level at slot i (Sedgewick's sink):
 *    leaf (2i + 1 ≥ n)            → one step: it stops (ask: keep sifting? no)
 *    two children                 → compare them, `c` = the smaller, left on ties
 *                                   (ask: which child does it compare with?)
 *    decide (a[i] <= a[c] stops)  → compare a[i] with a[c] (ask: keep sifting?)
 *    swap                         → `swap` + caret i follows the value
 *  One sift-up level at slot i: parent index (ask, Full: index of the parent),
 *  decide (a[p] <= a[i] stops; ask: keep sifting?), swap; at i = 0 it stops. */

import type { Id, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Ask, Distractor, MistakeKind } from '@/trace/asks';
import type { HeapInput } from './model';
import { parentOf } from './model';

export type { HeapInput, HeapOp } from './model';

export const A = 'a';
export const MIN = 'min';
export const HEAPS = 'heaps';

/** Pseudocode lines per variant (see index.ts). */
const LINES = {
  insert: { set: 2, loop: 3, parent: 4, decide: 5, swap: 6 },
  extract: { empty: 2, take: 3, fill: 4, leaf: 8, pick: 10, decide: 11, swap: 12, done: 14 },
  build: { start: 2, call: 3, leaf: 7, pick: 9, decide: 10, swap: 11 },
} as const;

interface SiftLines {
  leaf: number;
  pick: number;
  decide: number;
  swap: number;
}

const RULE_UP = 'A value sifts up while it is smaller than its parent, and stops at the root.';
const RULE_DOWN = 'A value sifts down while its smaller child is smaller than it, and stops at a leaf.';
const RULE_ROOT = 'At the root (i = 0) there is no parent: sifting up stops.';
const RULE_LEAF = 'A leaf has no children (2i + 1 ≥ n): sifting down stops.';
const RULE_EQUAL = 'Equal is in order: a parent equal to its child does not swap.';
const RULE_SMALLER_UP = 'A child smaller than its parent breaks the heap order, so the smaller value rises.';
const RULE_SMALLER_DOWN = 'A child smaller than the value breaks the heap order, so the value sinks.';
const RULE_LARGER = 'The parent is already ≤ the value: the heap order holds, so sifting stops.';
const RULE_CHILD = 'Compare with the smaller child; on equal children keep the left one.';
const RULE_NOT_LARGER = 'It compares with the smaller child: if the larger one rose, it would sit above a smaller sibling.';
const RULE_TIE = 'On equal children the left one is kept: a[r] < a[l] is a strict test.';
const RULE_PARENT = 'The parent of slot i is (i − 1) / 2, rounded down, in a 0-based array.';
const RULE_TAKE = 'In a min-heap the minimum is always the root, a[0].';
const RULE_LAST = 'extractMin takes the root, the minimum; the last element only refills the hole.';
const RULE_FILL = 'The last element fills the root and then sifts down; a child is never promoted directly.';
const RULE_START = 'Bottom-up build starts at the last parent, n/2 − 1: every slot after it is a leaf.';

const cmp = (a: number, b: number): '<' | '=' | '>' => (a < b ? '<' : a > b ? '>' : '=');

/** The generator's own model of the array: element ids by slot and values by id. */
class Heap {
  slots: Id[];
  vals = new Map<Id, number>();

  constructor(values: readonly number[]) {
    this.slots = values.map((v, i) => {
      const id = ids.el(i);
      this.vals.set(id, v);
      return id;
    });
  }

  get size(): number {
    return this.slots.length;
  }

  id(i: number): Id {
    const id = this.slots[i];
    if (id === undefined) throw new Error(`heap model: no slot ${i}`);
    return id;
  }

  v(i: number): number {
    return this.vals.get(this.id(i)) as number;
  }

  swap(i: number, j: number): void {
    const t = this.id(i);
    this.slots[i] = this.id(j);
    this.slots[j] = t;
  }
}

const slot = (i: number) => ({ arr: A, i });

export function* generate(input: HeapInput): Iterable<Step> {
  const h = new Heap(input.a);
  if (input.op === 'insert') yield* insert(h, input.x);
  else if (input.op === 'extract') yield* extract(h);
  else yield* build(h);
}

// ---------------------------------------------------------------- insert

function* insert(h: Heap, x: number): Iterable<Step> {
  const L = LINES.insert;
  const n = h.size;
  // initialState mints nothing, so this `set` is the run's first minted element.
  const id = ids.elIn(A, n, 1);
  h.slots.push(id);
  h.vals.set(id, x);
  yield {
    line: L.set,
    events: [
      { t: 'var', name: 'x', value: x },
      { t: 'array', name: A, size: n + 1 },
      { t: 'set', slot: slot(n), value: x },
      { t: 'mark', ref: { id }, as: 'active' },
      { t: 'pointer', name: 'i', at: slot(n) },
      { t: 'var', name: 'n', value: n + 1 },
      { t: 'var', name: 'i', value: n },
    ],
    note: n === 0 ? `The heap is empty: ${x} goes into a[0] and is the root.` : `${x} goes into the first free slot, a[${n}]; it may be smaller than its parent.`,
    phase: 'insert',
  };

  let i = n;
  const stop: VizEvent[] = [
    { t: 'mark', ref: { id }, as: null },
    { t: 'pointer', name: 'i', at: null },
    { t: 'pointer', name: 'p', at: null },
    { t: 'var', name: 'i', value: null },
  ];
  for (;;) {
    if (i === 0) {
      yield {
        line: L.loop,
        events: stop,
        note: `${x} is at the root a[0]: nothing is above it, so sifting up stops.`,
        phase: 'sift',
        ask: keepAsk('up', x, false, 'base-case', RULE_ROOT),
      };
      return;
    }
    const p = parentOf(i);
    yield {
      line: L.parent,
      events: [
        { t: 'pointer', name: 'p', at: slot(p) },
        { t: 'var', name: 'p', value: p },
      ],
      note: `The parent of a[${i}] is a[(${i} − 1) / 2] = a[${p}], holding ${h.v(p)}.`,
      phase: 'sift',
      ask: parentAsk(i, p),
    };
    const pv = h.v(p);
    const up = x < pv;
    yield {
      line: L.decide,
      events: [{ t: 'compare', a: { id: h.id(p) }, b: { id }, result: cmp(pv, x) }, ...(up ? [] : stop)],
      note: up ? `${x} < ${pv}: the parent is larger, so ${x} moves up.` : `Parent ${pv} ≤ ${x}: the heap order holds, so ${x} stays in a[${i}].`,
      phase: 'sift',
      ask: keepAsk('up', x, up, 'comparison', up ? RULE_SMALLER_UP : pv === x ? RULE_EQUAL : RULE_LARGER),
    };
    if (!up) return;
    h.swap(i, p);
    yield {
      line: L.swap,
      events: [
        { t: 'swap', a: slot(i), b: slot(p) },
        { t: 'pointer', name: 'i', at: slot(p) },
        { t: 'pointer', name: 'p', at: null },
        { t: 'var', name: 'i', value: p },
      ],
      note: `Swap: ${x} rises to a[${p}] and ${pv} moves down to a[${i}].`,
      phase: 'sift',
    };
    i = p;
  }
}

// ---------------------------------------------------------------- extract

function* extract(h: Heap): Iterable<Step> {
  const L = LINES.extract;
  const n = h.size;
  if (n === 0) {
    yield {
      line: L.empty,
      events: [
        { t: 'var', name: 'n', value: 0 },
        { t: 'var', name: 'min', value: 'none' },
      ],
      note: 'The heap is empty (n = 0): there is nothing to extract.',
      phase: 'extract',
    };
    return;
  }
  const root = h.id(0);
  const mv = h.v(0);
  const candidates = [...h.slots];
  const take: Step = {
    line: L.take,
    events: [
      { t: 'move', id: root, to: { arr: MIN, i: 0 } },
      { t: 'mark', ref: { id: root }, as: 'done' },
      { t: 'var', name: 'min', value: mv },
      { t: 'var', name: 'n', value: n - 1 },
      ...(n === 1 ? [{ t: 'array', name: A, size: 0 } as const] : []),
    ],
    note: n === 1 ? `The root a[0] = ${mv} is the minimum: take it; the heap is now empty.` : `The root a[0] = ${mv} is the minimum: take it out; n becomes ${n - 1}.`,
    phase: 'extract',
  };
  if (n >= 2) {
    const last = h.id(n - 1);
    take.ask = {
      kind: 'pick',
      level: 'guided',
      prompt: 'Which element does extractMin take?',
      answer: root,
      candidates,
      rule: RULE_TAKE,
      distractors: [{ answer: last, kind: 'order', rule: RULE_LAST }],
    };
  }
  yield take;
  if (n === 1) {
    yield { line: L.done, events: [], note: `Return ${mv}.`, phase: 'extract' };
    return;
  }

  const lastI = n - 1;
  const last = h.id(lastI);
  const lv = h.v(lastI);
  h.slots[0] = last;
  h.slots.pop();
  const fill: Step = {
    line: L.fill,
    events: [
      { t: 'move', id: last, to: slot(0) },
      { t: 'array', name: A, size: n - 1 },
      { t: 'mark', ref: { id: last }, as: 'active' },
      { t: 'pointer', name: 'i', at: slot(0) },
      { t: 'var', name: 'i', value: 0 },
    ],
    note: `The last element ${lv} moves from a[${lastI}] into the root; it must sift down.`,
    phase: 'extract',
  };
  const opts = [...new Set([1, 2, lastI].filter((k) => k <= lastI))].sort((p, q) => p - q).map((k) => `a[${k}]`);
  if (opts.length >= 2) {
    const answer = `a[${lastI}]`;
    fill.ask = {
      kind: 'choice',
      level: 'full',
      prompt: 'The root is empty. Which element moves into it?',
      options: opts,
      answer,
      rule: RULE_FILL,
      distractors: opts.filter((o) => o !== answer).map((o) => ({ answer: o, kind: 'order', rule: RULE_FILL })),
    };
  }
  yield fill;
  yield* siftDown(h, 0, L, 'sift', []);
  yield { line: L.done, events: [], note: `Return ${mv}; the ${h.size} values left are in heap order again.`, phase: 'extract' };
}

// ---------------------------------------------------------------- build

function* build(h: Heap): Iterable<Step> {
  const L = LINES.build;
  const n = h.size;
  const start = Math.floor(n / 2) - 1;
  if (start < 0) {
    yield {
      line: L.start,
      events: [
        { t: 'var', name: 'n', value: n },
        { t: 'var', name: 'k', value: -1 },
      ],
      note: n === 0 ? 'The array is empty: it is already a heap.' : 'One value is already a heap: there is no parent to sift.',
      phase: 'build',
    };
    return;
  }
  for (let k = start; k >= 0; k--) {
    const cur = h.id(k);
    const events: VizEvent[] = [];
    if (k === start) {
      events.push({ t: 'var', name: 'n', value: n }, { t: 'region', name: HEAPS, kind: 'ordered', arr: A, range: [start + 1, n - 1] });
    }
    events.push(
      { t: 'pointer', name: 'k', at: slot(k) },
      { t: 'pointer', name: 'i', at: slot(k) },
      { t: 'var', name: 'k', value: k },
      { t: 'var', name: 'i', value: k },
      { t: 'mark', ref: { id: cur }, as: 'active' },
    );
    const step: Step = {
      line: L.call,
      events,
      note: k === start ? `Slots ${start + 1} to ${n - 1} are leaves, already heaps: sift a[${k}] = ${h.v(k)} first.` : `k = ${k}: sift a[${k}] = ${h.v(k)} down; every slot after it heads a heap.`,
      phase: 'build',
    };
    if (k === start) step.ask = startAsk(h, start);
    yield step;
    yield* siftDown(h, k, L, 'sift', [{ t: 'region', name: HEAPS, kind: 'ordered', arr: A, range: [k, n - 1] }]);
  }
  yield {
    line: L.start,
    events: [
      { t: 'pointer', name: 'k', at: null },
      { t: 'var', name: 'k', value: -1 },
    ],
    note: 'k passes 0: every subtree, so the whole array, is now a heap.',
    phase: 'build',
  };
}

function startAsk(h: Heap, start: number): Ask {
  const n = h.size;
  const answer = h.id(start);
  const distractors: Distractor<Id>[] = [];
  const add = (i: number, kind: MistakeKind, rule: string) => {
    if (i < 0 || i >= n) return;
    const id = h.id(i);
    if (id === answer || distractors.some((d) => d.answer === id)) return;
    distractors.push({ answer: id, kind, rule });
  };
  add(Math.floor(n / 2), 'boundary', 'Slot n/2 is already a leaf: the last parent is n/2 − 1.');
  add(n - 1, 'boundary', 'Leaves are already heaps: start at the last parent, n/2 − 1.');
  add(0, 'order', 'Bottom-up: start at the last parent and walk back towards the root.');
  return { kind: 'pick', level: 'full', prompt: `Bottom-up build on n = ${n}: which element is sifted first?`, answer, candidates: [...h.slots], rule: RULE_START, distractors };
}

// ---------------------------------------------------------------- sift-down

/** Sifts the element at slot i down. `end` events are added to the step where
 *  it stops (build marks the finished subtree as a heap there). */
function* siftDown(h: Heap, start: number, L: SiftLines, phase: string, end: VizEvent[]): Iterable<Step> {
  const cur = h.id(start);
  const cv = h.v(start);
  const stop: VizEvent[] = [
    { t: 'mark', ref: { id: cur }, as: null },
    { t: 'pointer', name: 'i', at: null },
    { t: 'pointer', name: 'c', at: null },
    { t: 'var', name: 'i', value: null },
    ...end,
  ];
  let i = start;
  for (;;) {
    const n = h.size;
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l >= n) {
      yield {
        line: L.leaf,
        events: stop,
        note: `a[${i}] = ${cv} has no children (2·${i} + 1 ≥ ${n}): sifting stops.`,
        phase,
        ask: keepAsk('down', cv, false, 'base-case', RULE_LEAF),
      };
      return;
    }
    let c = l;
    const pre: VizEvent[] = [];
    if (r < n) {
      const lv = h.v(l);
      const rv = h.v(r);
      c = rv < lv ? r : l;
      const other = c === l ? r : l;
      yield {
        line: L.pick,
        events: [
          { t: 'compare', a: { id: h.id(r) }, b: { id: h.id(l) }, result: cmp(rv, lv) },
          { t: 'pointer', name: 'c', at: slot(c) },
          { t: 'var', name: 'c', value: c },
        ],
        note: rv === lv ? `Children ${lv} and ${rv} are equal: keep the left one, a[${l}].` : `Children ${lv} and ${rv}: the smaller is ${h.v(c)}, at a[${c}].`,
        phase,
        ask: {
          kind: 'pick',
          level: 'guided',
          prompt: `Sifting ${cv} down from a[${i}]: which child does it compare with?`,
          answer: h.id(c),
          candidates: [h.id(l), h.id(r)],
          rule: RULE_CHILD,
          distractors: [{ answer: h.id(other), kind: 'comparison', rule: rv === lv ? RULE_TIE : RULE_NOT_LARGER }],
        },
      };
    } else {
      pre.push({ t: 'pointer', name: 'c', at: slot(l) }, { t: 'var', name: 'c', value: l });
    }
    const chv = h.v(c);
    const down = chv < cv;
    const only = r >= n;
    yield {
      line: L.decide,
      events: [...pre, { t: 'compare', a: { id: cur }, b: { id: h.id(c) }, result: cmp(cv, chv) }, ...(down ? [] : stop)],
      note: down
        ? `${only ? 'Its only child ' : ''}${chv} < ${cv}: the child is smaller, so ${cv} sinks.`
        : `${cv} ≤ ${only ? 'its only child ' : ''}${chv}: the heap order holds, so ${cv} stays in a[${i}].`,
      phase,
      ask: keepAsk('down', cv, down, 'comparison', down ? RULE_SMALLER_DOWN : chv === cv ? RULE_EQUAL : 'The value is already ≤ its smaller child: the heap order holds, so sifting stops.'),
    };
    if (!down) return;
    h.swap(i, c);
    yield {
      line: L.swap,
      events: [
        { t: 'swap', a: slot(i), b: slot(c) },
        { t: 'pointer', name: 'i', at: slot(c) },
        { t: 'pointer', name: 'c', at: null },
        { t: 'var', name: 'i', value: c },
      ],
      note: `Swap: ${cv} sinks to a[${c}] and ${chv} rises to a[${i}].`,
      phase,
    };
    i = c;
  }
}

// ---------------------------------------------------------------- asks

function keepAsk(dir: 'up' | 'down', v: number, yes: boolean, kind: MistakeKind, wrongRule: string): Ask {
  const answer = yes ? 'yes' : 'no';
  return {
    kind: 'choice',
    level: 'guided',
    prompt: `Does ${v} keep sifting ${dir}?`,
    options: ['yes', 'no'],
    answer,
    rule: dir === 'up' ? RULE_UP : RULE_DOWN,
    distractors: [{ answer: yes ? 'no' : 'yes', kind, rule: wrongRule }],
  };
}

function parentAsk(i: number, p: number): Ask {
  const distractors: Distractor<number>[] = [];
  const add = (v: number, rule: string) => {
    if (v === p || v < 0 || distractors.some((d) => d.answer === v)) return;
    distractors.push({ answer: v, kind: 'boundary', rule });
  };
  add(Math.floor(i / 2), 'i / 2 is the 1-based formula; 0-based, the parent is (i − 1) / 2 rounded down.');
  add(i - 1, 'The parent is about halfway back, not the slot before.');
  add(2 * i + 1, '2i + 1 is the left child; the parent is (i − 1) / 2.');
  return { kind: 'value', level: 'full', prompt: `The value is at i = ${i}. What is the index of its parent?`, answer: p, rule: RULE_PARENT, distractors };
}
