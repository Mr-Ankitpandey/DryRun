/** Binary search generator: classic (find any index of x) and lower-bound
 *  (first index with a[i] >= x). See docs/ALGORITHMS.md §1. Elements never move
 *  in this algorithm, so the element at slot i is always ids.el(i). */

import type { Slot, Step } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Distractor } from '@/trace/asks';

export type Variant = 'classic' | 'lower';

export interface BinarySearchInput {
  a: number[];
  x: number;
  variant: Variant;
}

const A = 'a';
const slot = (i: number): Slot => ({ arr: A, i });
const el = (i: number) => ids.el(i);

const RULE_MID = 'mid is lo + (hi − lo) / 2, rounded down.';
const RULE_LOOP_CLASSIC = 'The loop runs while lo ≤ hi; it stops only when the range is empty.';
const RULE_LOOP_LOWER = 'The loop runs while lo < hi; when they meet, lo is the answer.';
const RULE_INVARIANT_CLASSIC = 'If x is present, it is inside [lo, hi].';
const RULE_INVARIANT_LOWER = 'The first index with a[i] ≥ x is inside [lo, hi].';

export function* generate(input: BinarySearchInput): Iterable<Step> {
  if (input.variant === 'lower') yield* lowerBound(input.a, input.x);
  else yield* classic(input.a, input.x);
}

function* classic(a: number[], x: number): Iterable<Step> {
  const n = a.length;

  yield {
    line: 1,
    events: [
      { t: 'var', name: 'x', value: x },
      { t: 'var', name: 'lo', value: 0 },
      { t: 'var', name: 'hi', value: n - 1 },
      { t: 'pointer', name: 'lo', at: slot(0) },
      { t: 'pointer', name: 'hi', at: slot(n - 1) },
      { t: 'region', name: 'elim-left', kind: 'eliminated', arr: A, range: null },
      { t: 'region', name: 'elim-right', kind: 'eliminated', arr: A, range: null },
    ],
    note: n === 0 ? 'The array is empty: lo = 0 and hi = −1, so the loop never runs.' : `lo = 0 and hi = ${n - 1}: if ${x} is present, it is inside [lo, hi].`,
    phase: 'setup',
  };

  let lo = 0;
  let hi = n - 1;
  let lastMid = -1;

  for (;;) {
    const cont = lo <= hi;
    yield {
      line: 2,
      events: [],
      note: cont ? `lo = ${lo} ≤ hi = ${hi}: the range is not empty, keep searching.` : `lo = ${lo} > hi = ${hi}: the range is empty, stop.`,
      phase: 'loop',
      ask: {
        kind: 'choice',
        level: 'full',
        prompt: `lo = ${lo}, hi = ${hi}. Does the loop run again?`,
        options: ['Yes: lo ≤ hi', 'No: lo > hi'],
        answer: cont ? 'Yes: lo ≤ hi' : 'No: lo > hi',
        rule: RULE_LOOP_CLASSIC,
        distractors: [{ answer: cont ? 'No: lo > hi' : 'Yes: lo ≤ hi', kind: 'base-case', rule: RULE_LOOP_CLASSIC }],
      },
    };
    if (!cont) break;

    const mid = lo + Math.floor((hi - lo) / 2);
    const ceil = lo + Math.ceil((hi - lo) / 2);
    const midDistractors: Distractor<string>[] = [];
    if (ceil !== mid) midDistractors.push({ answer: el(ceil), kind: 'boundary', rule: RULE_MID });
    if (lo !== mid) midDistractors.push({ answer: el(lo), kind: 'boundary', rule: 'mid is the middle of [lo, hi], not lo.' });
    yield {
      line: 3,
      events: [
        { t: 'pointer', name: 'mid', at: slot(mid) },
        { t: 'var', name: 'mid', value: mid },
      ],
      note: `mid = ${lo} + (${hi} − ${lo}) / 2 = ${mid}, rounded down.`,
      phase: 'loop',
      ask: {
        kind: 'pick',
        level: 'guided',
        prompt: `lo = ${lo}, hi = ${hi}. Where does mid land?`,
        answer: el(mid),
        candidates: candidates(lo, hi),
        rule: RULE_MID,
        distractors: midDistractors,
      },
    };

    const v = a[mid] as number;
    const result = v === x ? '=' : v < x ? '<' : '>';
    const outcome = result === '=' ? 'Found: return mid' : result === '<' ? 'lo = mid + 1' : 'hi = mid − 1';
    const options = ['Found: return mid', 'lo = mid + 1', 'hi = mid − 1'];
    yield {
      line: 4,
      events: [{ t: 'compare', a: { id: el(mid) }, b: { var: 'x' }, result }],
      note: result === '=' ? `a[mid] = ${v} equals ${x}.` : result === '<' ? `a[mid] = ${v} is less than ${x}: the answer is to the right of mid.` : `a[mid] = ${v} is greater than ${x}: the answer is to the left of mid.`,
      phase: 'loop',
      ask: {
        kind: 'choice',
        level: 'full',
        prompt: `a[mid] = ${v}, x = ${x}. What happens?`,
        options,
        answer: outcome,
        rule: 'a[mid] < x moves lo right; a[mid] > x moves hi left; equal means found.',
        distractors: options
          .filter((o) => o !== outcome)
          .map((o) => ({ answer: o, kind: 'comparison', rule: 'Compare a[mid] with x: smaller means go right, larger means go left.' })),
      },
    };

    if (result === '=') {
      yield {
        line: 4,
        events: [
          { t: 'mark', ref: { id: el(mid) }, as: 'done' },
          { t: 'var', name: 'result', value: mid },
        ],
        note: `Found ${x} at index ${mid}.`,
        phase: 'done',
        ask: {
          kind: 'value',
          level: 'guided',
          prompt: 'What index is returned?',
          answer: mid,
          rule: 'The index of mid is returned when a[mid] equals x.',
          distractors: (
            [{ answer: v, kind: 'unclassified', rule: 'Return the index, not the value.' }] satisfies Distractor<number>[]
          ).filter((d) => d.answer !== mid),
        },
      };
      return;
    }

    lastMid = mid;
    if (result === '<') {
      lo = mid + 1;
      const distractors: Distractor<string>[] = [{ answer: el(mid), kind: 'boundary', rule: 'lo moves past mid: a[mid] is already known not to be x.' }];
      if (mid + 2 < n) distractors.push({ answer: el(mid + 2), kind: 'boundary', rule: 'lo moves to mid + 1, not two past mid.' });
      const step: Step = {
        line: 5,
        events: [
          { t: 'var', name: 'lo', value: lo },
          { t: 'pointer', name: 'lo', at: slot(lo) },
          { t: 'region', name: 'elim-left', kind: 'eliminated', arr: A, range: [0, lo - 1] },
        ],
        note: `lo = mid + 1 = ${lo}: indexes 0..${mid} are eliminated.`,
        phase: 'loop',
      };
      if (lo < n) {
        step.ask = {
          kind: 'pick',
          level: 'guided',
          prompt: 'Where does lo move?',
          answer: el(lo),
          candidates: candidates(0, n - 1),
          rule: RULE_INVARIANT_CLASSIC,
          distractors,
        };
      }
      yield step;
    } else {
      hi = mid - 1;
      const distractors: Distractor<string>[] = [{ answer: el(mid), kind: 'boundary', rule: 'hi moves before mid: a[mid] is already known not to be x.' }];
      if (mid - 2 >= 0) distractors.push({ answer: el(mid - 2), kind: 'boundary', rule: 'hi moves to mid − 1, not two before mid.' });
      const step: Step = {
        line: 6,
        events: [
          { t: 'var', name: 'hi', value: hi },
          { t: 'pointer', name: 'hi', at: slot(hi) },
          { t: 'region', name: 'elim-right', kind: 'eliminated', arr: A, range: [hi + 1, n - 1] },
        ],
        note: `hi = mid − 1 = ${hi}: indexes ${mid}..${n - 1} are eliminated.`,
        phase: 'loop',
      };
      if (hi >= 0) {
        step.ask = {
          kind: 'pick',
          level: 'guided',
          prompt: 'Where does hi move?',
          answer: el(hi),
          candidates: candidates(0, n - 1),
          rule: RULE_INVARIANT_CLASSIC,
          distractors,
        };
      }
      yield step;
    }
  }

  const distractors: Distractor<number>[] = [];
  if (lastMid >= 0) distractors.push({ answer: lastMid, kind: 'boundary', rule: 'The last mid was checked and rejected; nothing is left, so the answer is −1.' });
  if (lo !== -1 && lo !== lastMid) distractors.push({ answer: lo, kind: 'boundary', rule: 'lo is where x would be inserted, not where it is.' });
  yield {
    line: 7,
    events: [{ t: 'var', name: 'result', value: -1 }],
    note: `${x} is not in the array: return −1.`,
    phase: 'done',
    ask: {
      kind: 'value',
      level: 'guided',
      prompt: 'What is returned?',
      answer: -1,
      rule: 'When the range becomes empty the target is absent, and −1 is returned.',
      distractors,
    },
  };
}

function* lowerBound(a: number[], x: number): Iterable<Step> {
  const n = a.length;

  yield {
    line: 1,
    events: [
      { t: 'var', name: 'x', value: x },
      { t: 'var', name: 'lo', value: 0 },
      { t: 'var', name: 'hi', value: n },
      { t: 'pointer', name: 'lo', at: slot(0) },
      { t: 'pointer', name: 'hi', at: slot(n) },
      { t: 'region', name: 'elim-left', kind: 'eliminated', arr: A, range: null },
      { t: 'region', name: 'elim-right', kind: 'eliminated', arr: A, range: null },
    ],
    note: n === 0 ? 'The array is empty: lo = hi = 0, the answer is 0.' : `lo = 0 and hi = ${n} (one past the end): the answer is inside [lo, hi].`,
    phase: 'setup',
  };

  let lo = 0;
  let hi = n;

  for (;;) {
    const cont = lo < hi;
    yield {
      line: 2,
      events: [],
      note: cont ? `lo = ${lo} < hi = ${hi}: keep narrowing.` : `lo = hi = ${lo}: they meet, stop.`,
      phase: 'loop',
      ask: {
        kind: 'choice',
        level: 'full',
        prompt: `lo = ${lo}, hi = ${hi}. Does the loop run again?`,
        options: ['Yes: lo < hi', 'No: lo = hi'],
        answer: cont ? 'Yes: lo < hi' : 'No: lo = hi',
        rule: RULE_LOOP_LOWER,
        distractors: [{ answer: cont ? 'No: lo = hi' : 'Yes: lo < hi', kind: 'base-case', rule: RULE_LOOP_LOWER }],
      },
    };
    if (!cont) break;

    const mid = lo + Math.floor((hi - lo) / 2);
    const ceil = lo + Math.ceil((hi - lo) / 2);
    // hi is exclusive here; the clickable range still includes it (when it is a
    // real cell) so that picking hi is graded as the boundary mistake it is.
    const lastClickable = Math.min(hi, n - 1);
    const midDistractors: Distractor<string>[] = [];
    if (ceil !== mid && ceil <= lastClickable) midDistractors.push({ answer: el(ceil), kind: 'boundary', rule: RULE_MID });
    if (lo !== mid) midDistractors.push({ answer: el(lo), kind: 'boundary', rule: 'mid is the middle of [lo, hi), not lo.' });
    yield {
      line: 3,
      events: [
        { t: 'pointer', name: 'mid', at: slot(mid) },
        { t: 'var', name: 'mid', value: mid },
      ],
      note: `mid = ${lo} + (${hi} − ${lo}) / 2 = ${mid}, rounded down.`,
      phase: 'loop',
      ask: {
        kind: 'pick',
        level: 'guided',
        prompt: `lo = ${lo}, hi = ${hi}. Where does mid land?`,
        answer: el(mid),
        candidates: candidates(lo, lastClickable),
        rule: RULE_MID,
        distractors: midDistractors,
      },
    };

    const v = a[mid] as number;
    const less = v < x;
    const options = ['lo = mid + 1', 'hi = mid', 'hi = mid − 1'];
    const outcome = less ? 'lo = mid + 1' : 'hi = mid';
    yield {
      line: less ? 4 : 5,
      events: [{ t: 'compare', a: { id: el(mid) }, b: { var: 'x' }, result: v < x ? '<' : v === x ? '=' : '>' }],
      note: less ? `a[mid] = ${v} < ${x}: mid is too small, the answer is to the right.` : `a[mid] = ${v} ≥ ${x}: mid could be the answer, so keep it.`,
      phase: 'loop',
      ask: {
        kind: 'choice',
        level: 'full',
        prompt: `a[mid] = ${v}, x = ${x}. What happens?`,
        options,
        answer: outcome,
        rule: 'a[mid] < x moves lo past mid; otherwise hi = mid keeps mid as a candidate.',
        distractors: (
          [
            { answer: less ? 'hi = mid' : 'lo = mid + 1', kind: 'comparison', rule: 'Compare a[mid] with x: smaller means go right, otherwise go left keeping mid.' },
            { answer: 'hi = mid − 1', kind: 'boundary', rule: 'a[mid] ≥ x means mid itself may be the first such index: keep it with hi = mid.' },
          ] satisfies Distractor<string>[]
        ).filter((d) => d.answer !== outcome),
      },
    };

    if (less) {
      lo = mid + 1;
      const step: Step = {
        line: 4,
        events: [
          { t: 'var', name: 'lo', value: lo },
          { t: 'pointer', name: 'lo', at: slot(lo) },
          { t: 'region', name: 'elim-left', kind: 'eliminated', arr: A, range: [0, lo - 1] },
        ],
        note: `lo = mid + 1 = ${lo}: indexes 0..${mid} are all < ${x}.`,
        phase: 'loop',
      };
      if (lo < n) {
        step.ask = {
          kind: 'pick',
          level: 'guided',
          prompt: 'Where does lo move?',
          answer: el(lo),
          candidates: candidates(0, n - 1),
          rule: RULE_INVARIANT_LOWER,
          distractors: [{ answer: el(mid), kind: 'boundary', rule: 'lo moves past mid: a[mid] < x, so mid cannot be the answer.' }],
        };
      }
      yield step;
    } else {
      hi = mid;
      const distractors: Distractor<string>[] = [];
      if (mid - 1 >= lo) distractors.push({ answer: el(mid - 1), kind: 'boundary', rule: 'hi = mid keeps a[mid], which may be the first element ≥ x.' });
      yield {
        line: 5,
        events: [
          { t: 'var', name: 'hi', value: hi },
          { t: 'pointer', name: 'hi', at: slot(hi) },
          { t: 'region', name: 'elim-right', kind: 'eliminated', arr: A, range: hi + 1 <= n - 1 ? [hi + 1, n - 1] : null },
        ],
        note: `hi = mid = ${hi}: everything after mid is eliminated, mid stays.`,
        phase: 'loop',
        ask: {
          kind: 'pick',
          level: 'guided',
          prompt: 'Where does hi move?',
          answer: el(hi),
          candidates: candidates(0, n - 1),
          rule: RULE_INVARIANT_LOWER,
          distractors,
        },
      };
    }
  }

  const distractors: Distractor<number>[] = [];
  if (lo - 1 >= 0) distractors.push({ answer: lo - 1, kind: 'boundary', rule: 'lo is the first index whose value is ≥ x; the one before it is smaller.' });
  yield {
    line: 6,
    events: [{ t: 'var', name: 'result', value: lo }, ...(lo < n ? [{ t: 'mark' as const, ref: { id: el(lo) }, as: 'done' as const }] : [])],
    note: lo < n ? `lo = ${lo}: a[${lo}] = ${a[lo]} is the first value ≥ ${x}.` : `lo = ${lo} = n: every value is < ${x}, the answer is one past the end.`,
    phase: 'done',
    ask: {
      kind: 'value',
      level: 'guided',
      prompt: 'What index is returned?',
      answer: lo,
      rule: 'When lo and hi meet, lo is the first index with a[i] ≥ x (n if none).',
      distractors,
    },
  };
}

function candidates(from: number, to: number): string[] {
  const out: string[] = [];
  for (let i = from; i <= to; i++) out.push(el(i));
  return out;
}
