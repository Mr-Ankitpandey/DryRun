/** Pure pieces of the trace player (no React): play timing, pick-hint order,
 *  labels for answers, the pool order of order-asks, layout width per form
 *  factor, the live invariant sentence and the mistake summary. Each one is
 *  unit tested in logic.test.ts. */

import type { Id, Ref, Scalar, Step } from '@/engine/events';
import type { Layout } from '@/engine/layout';
import { PAD, computeLayout } from '@/engine/layout';
import { GRAPH_NODE_R } from '@/engine/layout/graph';
import { TREE_NODE_R } from '@/engine/layout/tree';
import type { Run } from '@/engine/run';
import { applyEvent } from '@/engine/reducer';
import type { Scene } from '@/engine/scene';
import type { State, Transient } from '@/engine/state';
import { refToId } from '@/engine/state';
import type { Answer, Ask, MistakeKind } from '@/trace/asks';
import { MISTAKE_LABELS } from '@/trace/asks';
import type { Session } from '@/trace/session';
import { durations } from '@/ui/motion';

// ---------------------------------------------------------------- play timing

const TRAVEL = new Set(['move', 'swap', 'set', 'clear', 'node.add', 'node.detach', 'node.relink', 'node.remove', 'node.set']);
const TRANSIENT = new Set(['compare', 'read', 'skip']);

/** Motion length of a step (DESIGN §3): `l` when something travels, `s` for a
 *  step that only compares or reads, `m` for marks, pointers, regions and the rest. */
export function stepMotionMs(step: Step | undefined): number {
  if (!step || step.events.length === 0) return durations.s;
  if (step.events.some((e) => TRAVEL.has(e.t))) return durations.l;
  if (step.events.every((e) => TRANSIENT.has(e.t))) return durations.s;
  return durations.m;
}

/** Reading time after the motion lands, before play applies the next step: the
 *  note changes every step and a learner needs a beat to read it. */
export const READ_MS = durations.xl;

/** Delay before play applies the step after `shown` (the step whose result is
 *  on screen), at a playback speed. The very first tick after pressing play
 *  only waits `xs` so the press gets an immediate answer. */
export function playDelayMs(shown: Step | undefined, speed: number, first = false): number {
  const sp = speed > 0 ? speed : 1;
  if (first) return durations.xs;
  return Math.round((stepMotionMs(shown) + READ_MS) / sp);
}

// ---------------------------------------------------------------- pick hints

export interface Point {
  x: number;
  y: number;
}

/** Candidates in reading order: left to right, then top to bottom, then id. */
export function hintOrder(candidates: readonly Id[], pos: (id: Id) => Point | null): Id[] {
  return [...candidates].sort((a, b) => {
    const pa = pos(a);
    const pb = pos(b);
    if (pa && pb) {
      if (Math.abs(pa.x - pb.x) > 0.5) return pa.x - pb.x;
      if (Math.abs(pa.y - pb.y) > 0.5) return pa.y - pb.y;
    } else if (pa || pb) return pa ? -1 : 1;
    return a.localeCompare(b, 'en', { numeric: true });
  });
}

/** Number keys 1–9 for the first nine in order. */
export function keyHints(order: readonly Id[]): Map<Id, number> {
  const out = new Map<Id, number>();
  order.slice(0, 9).forEach((id, i) => out.set(id, i + 1));
  return out;
}

// ---------------------------------------------------------------- labels

/** How a learner names an element or node: its value, key or label. */
export function labelFor(scene: Scene, id: Id): string {
  const p = scene.prims.get(id);
  if (!p) return id;
  switch (p.kind) {
    case 'bar':
      return String(p.value);
    case 'tnode':
      return String(p.key);
    case 'gnode':
      return p.label;
    case 'cell':
      return p.value === null ? '' : String(p.value);
    default:
      return id;
  }
}

/** Accessible name of a pick target, with its position when it has one. */
export function targetLabel(scene: Scene, id: Id): string {
  const p = scene.prims.get(id);
  if (!p) return id;
  if (p.kind === 'bar') return `index ${p.index}, value ${p.value}`;
  if (p.kind === 'tnode') return `node ${p.key}`;
  if (p.kind === 'gnode') return `node ${p.label}`;
  return labelFor(scene, id);
}

/** Prints numbers with a real minus sign ("−1"). */
export function formatNumber(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

/** An answer as the learner would say it. A pick on an array names the slot
 *  and what it held when asked ("a[5] = 21"): some picks are positions (where
 *  the pivot lands), some are elements (which one shifts), and the value may
 *  move in the same step, so both are given. */
export function answerText(ask: Ask, answer: Answer, scene: Scene | null): string {
  switch (ask.kind) {
    case 'value':
      return typeof answer === 'number' ? formatNumber(answer) : String(answer);
    case 'choice':
      return String(answer);
    case 'pick': {
      const id = String(answer);
      if (!scene) return id;
      const p = scene.prims.get(id);
      if (p?.kind === 'bar') return `${p.arr}[${p.index}] = ${formatNumber(p.value)}`;
      return labelFor(scene, id);
    }
    case 'order':
      return (Array.isArray(answer) ? answer : [String(answer)]).map((id) => (scene ? labelFor(scene, id) : id)).join(' → ');
  }
}

/** The pool of an order-ask as it is offered: by label (numeric), never in
 *  answer order, so the layout does not give the answer away. */
export function poolOrder(pool: readonly Id[], label: (id: Id) => string): Id[] {
  return [...pool].sort((a, b) => label(a).localeCompare(label(b), 'en', { numeric: true }) || a.localeCompare(b, 'en', { numeric: true }));
}

// ---------------------------------------------------------------- layout width

export type FormFactor = 'mobile' | 'desktop';

/** Array cell width in scene units: 56 on desktop (the layout's maximum), 40
 *  on phones so a 9-cell array stays legible on a 358 px wide stage. */
export const CELL = { desktop: 56, mobile: 40 } as const;
/** Minimum gap between sibling nodes on the deepest tree row, per form factor. */
const NODE_GAP = { desktop: 24, mobile: 6 } as const;
/** DP grid cell size (the layout's maximum is 44). */
const GRID_CELL = { desktop: 44, mobile: 32 } as const;
/** Column pitch of the layered graph layout. */
const GRAPH_COL = { desktop: 150, mobile: 88 } as const;
const MIN_W = { desktop: 480, mobile: 320 } as const;
const MAX_W = 900;

/** The abstract width to lay a run out in, so the drawing is as compact as its
 *  content: an array is as wide as its cells, a tree as its deepest row needs,
 *  a graph as its columns, a DP grid as its cells. Computed once per run and
 *  form factor. */
export function layoutWidth(run: Run, form: FormFactor): number {
  const probe = computeLayout(run);
  const widths: number[] = [];
  if (probe.array) {
    const n = Math.max(1, ...Object.values(probe.array.rows).map((r) => r.n));
    widths.push(2 * PAD + n * CELL[form]);
  }
  if (probe.tree) {
    const depth = Math.max(1, probe.tree.depth);
    const sep = 2 * TREE_NODE_R + NODE_GAP[form];
    const span = (sep * 2 ** depth) / 2;
    widths.push(2 * (span * (1 - 2 ** -depth) + PAD + TREE_NODE_R));
  }
  if (probe.graph) {
    const cols = new Set(Object.values(probe.graph.pos).map((p) => Math.round(p.x))).size;
    widths.push(2 * PAD + 2 * GRAPH_NODE_R + Math.max(0, cols - 1) * GRAPH_COL[form]);
  }
  if (probe.grid) {
    widths.push(2 * PAD + (probe.grid.cols + 1) * GRID_CELL[form]);
  }
  if (widths.length === 0) return MAX_W;
  return Math.round(Math.min(MAX_W, Math.max(MIN_W[form], ...widths)));
}

/** Convenience: the layout for a run at a form factor. */
export function layoutFor(run: Run, form: FormFactor): Layout {
  return computeLayout(run, { width: layoutWidth(run, form) });
}

// ---------------------------------------------------------------- invariant

export type InvariantPart = { text: string } | { name: string; value: string | null };

/** Splits the invariant sentence so every variable it names that exists in the
 *  state is shown with its live value ("[lo, hi]" → lo = 2, hi = 8). A name
 *  that comes back later in the sentence gets its value only the first time. */
export function invariantParts(sentence: string, vars: Record<string, Scalar>): InvariantPart[] {
  const names = Object.keys(vars).filter((n) => /^[A-Za-z_]\w*$/.test(n) && (typeof vars[n] === 'number' || typeof vars[n] === 'string'));
  if (names.length === 0) return [{ text: sentence }];
  const re = new RegExp(`\\b(${names.sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');
  const out: InvariantPart[] = [];
  let last = 0;
  const seen = new Set<string>();
  for (const match of sentence.matchAll(re)) {
    const i = match.index;
    const name = match[1] as string;
    if (i > last) out.push({ text: sentence.slice(last, i) });
    const v = vars[name];
    out.push({ name, value: seen.has(name) ? null : typeof v === 'number' ? formatNumber(v) : String(v) });
    seen.add(name);
    last = i + name.length;
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last) });
  return out;
}

// ---------------------------------------------------------------- summary

export interface MistakeGroup {
  kind: MistakeKind;
  label: string;
  count: number;
  /** Distinct rule sentences, in the order they were first broken. */
  rules: string[];
}

/** Wrong answers of a session grouped by mistake kind, most frequent first. */
export function mistakesByKind(session: Session): MistakeGroup[] {
  const groups = new Map<MistakeKind, MistakeGroup>();
  for (const a of session.answers) {
    if (a.result.correct) continue;
    const kind = a.result.kind ?? 'unclassified';
    const g = groups.get(kind) ?? { kind, label: MISTAKE_LABELS[kind], count: 0, rules: [] };
    g.count += 1;
    const rule = a.result.rule ?? '';
    if (rule && !g.rules.includes(rule)) g.rules.push(rule);
    groups.set(kind, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** "5 of 6 right" with a rounded percentage, or null before any answer. */
export function scoreLine(asked: number, correct: number): string | null {
  if (asked === 0) return null;
  return `${correct} of ${asked} right (${Math.round((100 * correct) / asked)} %)`;
}

// ---------------------------------------------------------------- transient refs

const isSlot = (r: Ref): r is { arr: string; i: number } => 'arr' in r;

/** The scene resolves a compare/read/skip that names a *slot* against the state
 *  after the whole step, so when the same step also moves elements the
 *  highlight lands on whatever moved into the slot. This re-resolves those
 *  refs against the state at the moment of the event (replaying the step's
 *  events on the state before it) and pins them to element ids. Steps without
 *  slot refs are returned unchanged. */
export function resolveTransient(before: State | undefined, step: Step | undefined, after: State): State {
  if (!before || !step) return after;
  const hasSlot = step.events.some((e) => (e.t === 'compare' && (isSlot(e.a) || isSlot(e.b))) || ((e.t === 'read' || e.t === 'skip') && isSlot(e.ref)));
  if (!hasSlot) return after;
  const pin = (s: State, r: Ref): Ref => {
    if (!isSlot(r)) return r;
    try {
      const id = refToId(s, r);
      return id === null ? r : { id };
    } catch {
      return r;
    }
  };
  const t: Transient = { compares: [], reads: [], skips: [] };
  let s: State = { ...before, transient: { compares: [], reads: [], skips: [] } };
  for (const ev of step.events) {
    if (ev.t === 'compare') t.compares.push(ev.result ? { a: pin(s, ev.a), b: pin(s, ev.b), result: ev.result } : { a: pin(s, ev.a), b: pin(s, ev.b) });
    else if (ev.t === 'read') t.reads.push(pin(s, ev.ref));
    else if (ev.t === 'skip') t.skips.push({ ref: pin(s, ev.ref), reason: ev.reason });
    s = applyEvent(s, ev);
  }
  return { ...after, transient: t };
}
