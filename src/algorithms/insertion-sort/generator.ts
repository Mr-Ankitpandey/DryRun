/** Insertion sort with a lifted key. See docs/ALGORITHMS.md §2.
 *  The key is `move`d into a 1-slot array 'hold' (declared with `array`), so its
 *  slot in 'a' is empty during the pass: that gap is why a shift is a move into
 *  the gap, not a swap. Step rhythm per pass i:
 *    lift (line 2: key → hold[0], `mark key`) →
 *    per j: compare a[j] with key (line 3) and, when a[j] > key, one shift step
 *    (line 4: `move` a[j] → slot j + 1, then j − 1; line 5 is folded in) →
 *    land (line 6: `move` key → slot j + 1, region 'sorted' [0, i]).
 *  When j reaches −1 the loop ends without a compare (the `j >= 0` test fails);
 *  the landing step says so. `>` is strict, so an equal a[j] stops the scan and
 *  equal keys keep their input order (stable).
 *
 *  "Where does the key land?" is a `choice` over slot names, not a `pick`: the
 *  landing place is an empty slot, and a slot is not an element id. */

import type { Id, Slot, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Ask, Distractor } from '@/trace/asks';

export interface InsertionSortInput {
  a: number[];
}

export const A = 'a';
export const HOLD = 'hold';
const slot = (i: number): Slot => ({ arr: A, i });
const HELD: Slot = { arr: HOLD, i: 0 };

const RULE_SHIFT = 'The element right next to the gap, a[j], shifts one slot right into the gap.';
const RULE_SWAP = 'Shifting moves a[j] into the gap; the key stays lifted until its place is found.';
const RULE_BOUNDARY = 'Only a[j], the element directly left of the gap, shifts next; a[j − 1] waits its turn.';
const RULE_COMPARE = 'a[j] shifts only when a[j] > key; an equal a[j] stays put, which keeps the sort stable.';
const RULE_LAND = 'The key lands at j + 1: one slot right of the element that stopped the scan.';
const RULE_EQUAL = 'Equal keys do not shift: the scan needs a[j] > key, so the key lands right of its equal.';
const RULE_FRONT = 'The key slides left only past elements greater than it; it stops at j + 1, not at the front.';

export const slotName = (i: number): string => `slot ${i}`;

export function* generate(input: InsertionSortInput): Iterable<Step> {
  const a = input.a.slice();
  const n = a.length;
  /** slot → element id, mirrored so asks can name elements. null = the gap. */
  const at: (Id | null)[] = a.map((_, i) => ids.el(i));

  // ---- setup
  const setup: VizEvent[] = [];
  if (n >= 2) setup.push({ t: 'array', name: HOLD, size: 1 });
  setup.push({ t: 'region', name: 'sorted', kind: 'sorted', arr: A, range: n === 0 ? null : [0, 0] });
  yield {
    line: 1,
    events: setup,
    note: n === 0 ? 'The array is empty: there is nothing to sort.' : n === 1 ? 'One element is already a sorted prefix: nothing to insert.' : `a[0] = ${a[0]} alone is a sorted prefix; i starts at 1.`,
    phase: 'setup',
  };

  for (let i = 1; i < n; i++) {
    const key = a[i] as number;
    const keyId = at[i] as Id;
    at[i] = null;
    let j = i - 1;
    yield {
      line: 2,
      events: [
        { t: 'var', name: 'i', value: i },
        { t: 'var', name: 'key', value: key },
        { t: 'var', name: 'j', value: j },
        { t: 'pointer', name: 'i', at: slot(i) },
        { t: 'pointer', name: 'j', at: slot(j) },
        { t: 'move', id: keyId, to: HELD },
        { t: 'mark', ref: { id: keyId }, as: 'key' },
      ],
      note: `key = a[${i}] = ${key} is lifted out; slot ${i} is now the gap.`,
      phase: 'insert',
    };

    while (j >= 0) {
      const aj = a[j] as number;
      const shifts = aj > key;
      yield {
        line: 3,
        events: [{ t: 'compare', a: slot(j), b: HELD, result: aj > key ? '>' : aj === key ? '=' : '<' }],
        note: shifts ? `a[${j}] = ${aj} > key ${key}: a larger element must make room for the key.` : aj === key ? `a[${j}] = ${aj} equals key ${key}: not greater, so the scan stops.` : `a[${j}] = ${aj} < key ${key}: the scan stops.`,
        phase: 'insert',
        ask: {
          kind: 'choice',
          level: 'full',
          prompt: `a[${j}] = ${aj}, key = ${key}. Does a[${j}] shift?`,
          options: ['yes', 'no'],
          answer: shifts ? 'yes' : 'no',
          rule: RULE_COMPARE,
          distractors: [{ answer: shifts ? 'no' : 'yes', kind: 'comparison', rule: RULE_COMPARE }],
        },
      };
      if (!shifts) break;

      const mover = at[j] as Id;
      const candidates: Id[] = [...at.filter((x): x is Id => x !== null), keyId];
      const distractors: Distractor<Id>[] = [{ answer: keyId, kind: 'shift-vs-swap', rule: RULE_SWAP }];
      const left = j >= 1 ? at[j - 1] : null;
      if (left) distractors.push({ answer: left, kind: 'boundary', rule: RULE_BOUNDARY });
      a[j + 1] = aj;
      at[j + 1] = mover;
      at[j] = null;
      j--;
      yield {
        line: 4,
        events: [
          { t: 'move', id: mover, to: slot(j + 2) },
          { t: 'var', name: 'j', value: j },
          { t: 'pointer', name: 'j', at: slot(j) },
        ],
        note: `${aj} shifts right into slot ${j + 2}; the gap moves to slot ${j + 1}.`,
        phase: 'insert',
        ask: { kind: 'pick', level: 'guided', prompt: `key = ${key}. Which element shifts next?`, answer: mover, candidates, rule: RULE_SHIFT, distractors },
      };
    }

    const land = j + 1;
    a[land] = key;
    at[land] = keyId;
    const last = i === n - 1;
    const events: VizEvent[] = [
      { t: 'move', id: keyId, to: slot(land) },
      { t: 'mark', ref: { id: keyId }, as: null },
      { t: 'region', name: 'sorted', kind: 'sorted', arr: A, range: [0, i] },
    ];
    if (last) {
      events.push({ t: 'pointer', name: 'i', at: null }, { t: 'pointer', name: 'j', at: null });
    }
    const where = land === i ? `key ${key} goes back to slot ${land}` : land === 0 ? `j = −1: key ${key} lands at the front, slot 0` : `key ${key} lands in slot ${land}, right of ${a[j]}`;
    yield {
      line: 6,
      events,
      note: last ? `${where}; the whole array is sorted.` : `${where}; a[0..${i}] is sorted.`,
      phase: 'insert',
      ask: landAsk(i, j, key, a),
    };
  }
}

/** "Where does the key land?" as a choice over slots 0..i (a slot is not an element). */
function landAsk(i: number, j: number, key: number, a: readonly number[]): Ask {
  const options = Array.from({ length: i + 1 }, (_, k) => slotName(k));
  const answer = slotName(j + 1);
  const distractors: Distractor<string>[] = [];
  const add = (k: number, kind: Distractor<string>['kind'], rule: string) => {
    const s = slotName(k);
    if (k < 0 || k > i || s === answer || distractors.some((d) => d.answer === s)) return;
    distractors.push({ answer: s, kind, rule });
  };
  if (j >= 0) add(j, a[j] === key ? 'comparison' : 'boundary', a[j] === key ? RULE_EQUAL : RULE_LAND);
  add(0, 'boundary', RULE_FRONT);
  return { kind: 'choice', level: 'guided', prompt: `The scan is over. Where does key ${key} land?`, options, answer, rule: RULE_LAND, distractors };
}
