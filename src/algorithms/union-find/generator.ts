/** Union-find with union by rank and path compression, on a forest. See
 *  docs/ALGORITHMS.md §13. The forest (`forest` + one root per element) and
 *  the parent[] array are in the initial state; every root carries its rank as
 *  a label ("rank 1"); a node that stops being a root loses the label.
 *
 *  Step rhythm:
 *    find(x): walk (line 3: the whole path to the root in one step: path
 *    nodes `visited`, the root `active`, parent[] cells read) → one step per
 *    compressed pointer (line 5: `set` parent[x] = r + `node.relink` x under r)
 *    → standalone finds end with "returns r" (line 6).
 *    union(a, b): find(a), find(b) (the first root stays marked `key`) → same
 *    set? (line 9) → which root goes on top (line 10 by rank, 11 on a tie) →
 *    link and rank in one step (line 12, or 13 when the rank grows: `set` +
 *    `node.relink` + labels), so the rank bounds the height in every state.
 *  Asks: which root find reaches (guided, when x is not a root itself); where a
 *  compressed node points (full); same set? (guided); which root becomes the
 *  parent (guided); the rank after the union (full). */

import type { Id, MarkKind, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import type { Ask, Distractor } from '@/trace/asks';
import type { UfInput, UfOp } from './model';
import { Dsu } from './model';

export type { UfInput, UfOp } from './model';

export const PARENT = 'parent';

const RULE_ROOT = 'find follows parent pointers until it reaches a node that points to itself: the root.';
const RULE_EARLY = 'Keep following parent pointers: only a node with parent[r] == r is a root.';
const RULE_COMPRESS = 'Path compression points every node on the path straight at the root.';
const RULE_OLD = 'After compression the node skips its old parent and points at the root itself.';
const RULE_SAME = 'Two elements are in the same set exactly when find gives both the same root.';
const RULE_PARENT = 'Union by rank: the root with the larger rank becomes the parent; on equal ranks, the smaller id.';
const RULE_TALLER = 'The larger rank goes on top, so the shorter tree hangs under the taller one.';
const RULE_TIE = 'On equal ranks the smaller id becomes the parent here.';
const RULE_RANK = 'The rank grows by one only when two equal ranks meet; otherwise it stays.';

const node = (v: number): Id => ids.node(v);
export const rankText = (r: number): string => `rank ${r}`;

class Marks {
  cur = new Map<number, MarkKind>();

  /** Events that turn the current marks into `next`. */
  to(next: Map<number, MarkKind>): VizEvent[] {
    const out: VizEvent[] = [];
    for (const [v] of this.cur) if (!next.has(v)) out.push({ t: 'mark', ref: { id: node(v) }, as: null });
    for (const [v, m] of next) if (this.cur.get(v) !== m) out.push({ t: 'mark', ref: { id: node(v) }, as: m });
    this.cur = new Map(next);
    return out;
  }
}

export function* generate(input: UfInput): Iterable<Step> {
  const d = new Dsu(input.n);
  const marks = new Marks();
  const finds: number[] = [];
  for (let k = 0; k < input.ops.length; k++) {
    const op = input.ops[k] as UfOp;
    const opVar: VizEvent = { t: 'var', name: 'op', value: k + 1 };
    if (op.t === 'f') {
      const r = yield* find(d, marks, op.x, `find(${op.x})`, new Map(), opVar);
      finds.push(r);
      yield {
        line: 6,
        events: [...marks.to(new Map()), { t: 'var', name: 'finds', value: finds.join(',') }],
        note: `find(${op.x}) returns ${r}.`,
        phase: 'find',
      };
    } else {
      yield* union(d, marks, op.a, op.b, opVar);
    }
  }
}

/** Walks to the root and compresses the path. `keep` marks stay as they are. */
function* find(d: Dsu, marks: Marks, x: number, label: string, keep: Map<number, MarkKind>, opVar: VizEvent | null): Generator<Step, number, undefined> {
  const path = d.path(x);
  const r = path[path.length - 1] as number;
  const next = new Map(keep);
  for (const v of path.slice(0, -1)) next.set(v, 'visited');
  next.set(r, 'active');
  const events: VizEvent[] = [
    ...(opVar ? [opVar] : []),
    ...marks.to(next).filter((e) => !(e.t === 'mark' && 'id' in e.ref && e.ref.id === node(r))),
    // Always named, even when it was already active: this step reveals the root.
    { t: 'mark', ref: { id: node(r) }, as: 'active' },
    ...path.map((v): VizEvent => ({ t: 'read', ref: { arr: PARENT, i: v } })),
    { t: 'var', name: 'r', value: r },
  ];
  const walk: Step = {
    line: 3,
    events,
    note: path.length === 1 ? `${label}: parent[${x}] = ${x}, so ${x} is a root already.` : `${label}: ${path.join(' → ')}, and parent[${r}] = ${r}: the root is ${r}.`,
    phase: 'find',
  };
  if (path.length >= 2) {
    const distractors: Distractor<Id>[] = [];
    const add = (v: number) => {
      if (v !== r && !distractors.some((dd) => dd.answer === node(v))) distractors.push({ answer: node(v), kind: 'base-case', rule: RULE_EARLY });
    };
    add(path[1] as number);
    add(x);
    walk.ask = {
      kind: 'pick',
      level: 'guided',
      prompt: `Which root does ${label} reach?`,
      answer: node(r),
      candidates: Array.from({ length: d.parent.length }, (_, v) => node(v)),
      rule: RULE_ROOT,
      distractors,
    };
  }
  yield walk;

  // Two-pass compression: every node on the path except the root and its
  // direct child gets pointed at the root, from x upwards.
  for (let i = 0; i + 2 < path.length; i++) {
    const v = path[i] as number;
    const old = path[i + 1] as number;
    d.parent[v] = r;
    const distractors: Distractor<Id>[] = [{ answer: node(old), kind: 'dependency', rule: RULE_OLD }];
    const grand = path[i + 2] as number;
    if (grand !== r) distractors.push({ answer: node(grand), kind: 'dependency', rule: RULE_COMPRESS });
    yield {
      line: 5,
      events: [
        { t: 'set', slot: { arr: PARENT, i: v }, value: r },
        { t: 'node.relink', id: node(v), parent: node(r), side: null },
      ],
      note: `Compress: parent[${v}] = ${r}; ${v} now points straight at the root.`,
      phase: 'compress',
      ask: {
        kind: 'pick',
        level: 'full',
        prompt: `Path compression: where does ${v} point now?`,
        answer: node(r),
        candidates: Array.from({ length: d.parent.length }, (_, w) => node(w)),
        rule: RULE_COMPRESS,
        distractors,
      },
    };
  }
  return r;
}

function* union(d: Dsu, marks: Marks, a: number, b: number, opVar: VizEvent): Iterable<Step> {
  const ra = yield* find(d, marks, a, `union(${a}, ${b}): find(${a})`, new Map(), opVar);
  const rb = yield* find(d, marks, b, `find(${b})`, new Map([[ra, 'key']]), null);
  const same = ra === rb;
  const sameAsk: Ask = {
    kind: 'choice',
    level: 'guided',
    prompt: `Are ${a} and ${b} already in the same set?`,
    options: ['yes', 'no'],
    answer: same ? 'yes' : 'no',
    rule: RULE_SAME,
    distractors: [{ answer: same ? 'no' : 'yes', kind: 'comparison', rule: RULE_SAME }],
  };
  if (same) {
    yield {
      line: 9,
      events: [{ t: 'compare', a: { id: node(ra) }, b: { id: node(rb) }, result: '=' }, ...marks.to(new Map())],
      note: `Both roots are ${ra}: ${a} and ${b} are in the same set, nothing to do.`,
      phase: 'union',
      ask: sameAsk,
    };
    return;
  }
  const rankA = d.rank[ra] as number;
  const rankB = d.rank[rb] as number;
  yield {
    line: 9,
    events: marks.to(
      new Map([
        [ra, 'key'],
        [rb, 'key'],
      ]),
    ),
    note: `The roots differ (${ra} and ${rb}): the two sets merge.`,
    phase: 'union',
    ask: sameAsk,
  };

  let top = ra;
  let low = rb;
  if (rankA < rankB || (rankA === rankB && rb < ra)) [top, low] = [rb, ra];
  const tie = rankA === rankB;
  const options = [String(Math.min(ra, rb)), String(Math.max(ra, rb))];
  yield {
    line: tie ? 11 : 10,
    events: [{ t: 'compare', a: { id: node(ra) }, b: { id: node(rb) }, result: rankA < rankB ? '<' : rankA > rankB ? '>' : '=' }],
    note: tie ? `Ranks are equal (${rankA}): the smaller id, ${top}, goes on top.` : `rank[${top}] = ${d.rank[top]} > rank[${low}] = ${d.rank[low]}: ${top} goes on top.`,
    phase: 'union',
    ask: {
      kind: 'choice',
      level: 'guided',
      prompt: `Roots ${ra} (rank ${rankA}) and ${rb} (rank ${rankB}): which becomes the parent?`,
      options,
      answer: String(top),
      rule: RULE_PARENT,
      distractors: [{ answer: String(low), kind: 'comparison', rule: tie ? RULE_TIE : RULE_TALLER }],
    },
  };

  // Link and rank update are one step: between the two lines the rank
  // would not yet bound the new height.
  d.parent[low] = top;
  const before = d.rank[top] as number;
  const grows = before === (d.rank[low] as number);
  if (grows) d.rank[top] = before + 1;
  const after = d.rank[top] as number;
  yield {
    line: grows ? 13 : 12,
    events: [
      { t: 'set', slot: { arr: PARENT, i: low }, value: top },
      { t: 'node.relink', id: node(low), parent: node(top), side: null },
      { t: 'label', id: node(low), text: null },
      ...(grows ? [{ t: 'label', id: node(top), text: rankText(after) } as VizEvent] : []),
      ...marks.to(new Map()),
    ],
    note: grows ? `parent[${low}] = ${top}; the ranks were equal, so rank[${top}] grows to ${after}.` : `parent[${low}] = ${top}: ${low}'s tree hangs under ${top}; rank[${top}] stays ${after}.`,
    phase: 'union',
    ask: { kind: 'value', level: 'full', prompt: `What is rank[${top}] after this union?`, answer: after, rule: RULE_RANK, distractors: [{ answer: grows ? before : before + 1, kind: 'comparison', rule: RULE_RANK }] },
  };
}

/** Forest (one root per element, each labelled with rank 0) and parent[]:
 *  applied by `initialState` so step 0 shows every set. */
export function structure(input: UfInput): VizEvent[] {
  const out: VizEvent[] = [{ t: 'forest' }, { t: 'array.flat', arr: PARENT }];
  for (let v = 0; v < input.n; v++) {
    out.push({ t: 'node.add', id: node(v), key: v, parent: null, side: null }, { t: 'label', id: node(v), text: rankText(0) });
  }
  return out;
}
