/** Blind level, as pure functions (no React, no DOM). Blind uses the Guided
 *  asks; between two asks the stage stays frozen on the last confirmed state
 *  and the steps up to the next ask run hidden:
 *
 *    ask i-1 at step A      answered, revealed: the stage shows state A + 1
 *    frozen point F         A + 1 (0 before the first ask), moved forward only
 *                           as far as needed for the frozen stage to draw what
 *                           the ask is about: the structures (a graph, a tree's
 *                           nodes, a DP grid, the arrays: Dijkstra's setup step,
 *                           a BST's build prelude) and every pick target. Those
 *                           steps play visibly, like Guided.
 *    hidden steps           steps F .. G − 1, never drawn, narrated or scrubbable
 *    ask i at step G        opens on the frozen stage at k = F
 *    after the answer       steps F .. G play quickly (the reveal), then the
 *                           verdict at k = G + 1, the next frozen point
 *
 *  The timeline gate is F, so play, step and scrub all stop there: the only
 *  way past the hidden range is to answer. Guided and Full use session.gate
 *  unchanged (`timelineGate`).
 *
 *  Picks are made on the frozen stage by identity (the learner clicks the
 *  element they believe e.g. shifts next, wherever it is drawn now), except
 *  "Where …?" picks, which name a slot: the learner clicks the element drawn
 *  in that slot now and the answer is whatever sits in the slot at the ask. */

import type { Id, Step } from '@/engine/events';
import type { Run } from '@/engine/run';
import type { State } from '@/engine/state';
import { elementAt, slotOf } from '@/engine/state';
import type { Level } from '@/lib/storage';
import type { Ask } from '@/trace/asks';
import type { Session } from '@/trace/session';
import { playDelayMs } from './logic';

/** Playback speed of the reveal after a blind answer (DESIGN §3: 2× halves
 *  every duration; one semantic change per step still). */
export const REVEAL_SPEED = 2;

/** Is an element, node or cell drawn in this state? (Mirrors what the scene
 *  builder draws for pick targets: array slots, tree nodes, graph nodes, grid cells.) */
export function onStage(state: State, id: Id): boolean {
  if (slotOf(state, id) !== null) return true;
  if (state.tree[id]) return true;
  if (state.graph?.nodes.some((n) => n.id === id)) return true;
  const cell = /^c:(\d+),(\d+)$/.exec(id);
  if (cell && state.grid) return Number(cell[1]) < state.grid.rows && Number(cell[2]) < state.grid.cols; // empty cells are drawn too
  return false;
}

/** A pick that asks for a place ("Where does mid land?") rather than an
 *  element: every candidate is an array element and the prompt asks where. */
export function isSlotPick(ask: Ask, atAsk: State): boolean {
  if (ask.kind !== 'pick' || !/\bwhere\b/i.test(ask.prompt)) return false;
  return ask.candidates.every((id) => slotOf(atAsk, id) !== null);
}

/** The pick targets as drawn on the frozen stage, in candidate order, or null
 *  when one of them is not on it. Identity picks keep their ids; slot picks
 *  become the elements now drawn in the candidate slots. */
export function frozenTargets(ask: Ask, frozen: State, atAsk: State): Id[] | null {
  if (ask.kind !== 'pick') return [];
  const out: Id[] = [];
  const slots = isSlotPick(ask, atAsk);
  for (const id of ask.candidates) {
    let target: Id | null = id;
    if (slots) {
      const slot = slotOf(atAsk, id);
      target = slot && inRange(frozen, slot) ? elementAt(frozen, slot) : null;
    }
    if (target === null || !onStage(frozen, target)) return null;
    out.push(target);
  }
  return out;
}

function inRange(state: State, slot: { arr: string; i: number }): boolean {
  const arr = state.arrays[slot.arr];
  return !!arr && slot.i >= 0 && slot.i < arr.slots.length;
}

/** The element a pick on the frozen stage names at the ask (slot picks
 *  translate through the slot; identity picks are unchanged). */
export function askIdOf(ask: Ask, picked: Id, frozen: State, atAsk: State): Id {
  if (!isSlotPick(ask, atAsk)) return picked;
  const slot = slotOf(frozen, picked);
  if (!slot || !inRange(atAsk, slot)) return picked;
  return elementAt(atAsk, slot) ?? picked;
}

/** The inverse of `askIdOf` for the answer: where the learner has to click. */
export function frozenIdOf(ask: Ask, id: Id, frozen: State, atAsk: State): Id {
  if (!isSlotPick(ask, atAsk)) return id;
  const slot = slotOf(atAsk, id);
  if (!slot || !inRange(frozen, slot)) return id;
  return elementAt(frozen, slot) ?? id;
}

/** The ask as the learner sees it on the frozen stage: a pick's candidates
 *  and answer are the frozen targets (identical for identity picks). Grading
 *  always uses the real ask with `askIdOf` of the pick. */
export function frozenAsk(ask: Ask, frozen: State, atAsk: State): Ask {
  if (ask.kind !== 'pick' || !isSlotPick(ask, atAsk)) return ask;
  const candidates = frozenTargets(ask, frozen, atAsk) ?? ask.candidates;
  return { ...ask, answer: frozenIdOf(ask, ask.answer, frozen, atAsk), candidates };
}

/** Does the frozen stage draw every structure the stage at the ask draws?
 *  Graph and tree nodes, the DP grid and the arrays (by name); elements and
 *  values may differ, that is what runs hidden. */
export function drawsStructures(frozen: State, atAsk: State): boolean {
  if (atAsk.graph) {
    const nodes = frozen.graph?.nodes;
    if (!nodes || atAsk.graph.nodes.some((n) => !nodes.some((m) => m.id === n.id))) return false;
  }
  for (const id of Object.keys(atAsk.tree)) if (!frozen.tree[id]) return false;
  if (atAsk.grid && !frozen.grid) return false;
  for (const name of Object.keys(atAsk.arrays)) if (!frozen.arrays[name]) return false;
  return true;
}

/** Where the stage freezes for the ask at `cursor`: right after the previous
 *  ask's step (0 before the first), moved forward only as far as needed for
 *  the frozen stage to draw the ask's structures and every pick target. Past
 *  the last ask: the end. */
export function frozenPoint(run: Run, askIndices: readonly number[], cursor: number): number {
  const prev = askIndices[cursor - 1];
  let f = prev === undefined ? 0 : prev + 1;
  const g = askIndices[cursor];
  if (g === undefined) return run.steps.length;
  const ask = run.steps[g]?.ask;
  const atAsk = run.states[g];
  if (!ask || !atAsk) return f;
  while (f < g) {
    const frozen = run.states[f];
    if (frozen && drawsStructures(frozen, atAsk) && (ask.kind !== 'pick' || frozenTargets(ask, frozen, atAsk) !== null)) break;
    f++;
  }
  return f;
}

export interface BlindView {
  /** k the stage is frozen at while the ask is pending. */
  frozenK: number;
  /** Step index of the pending ask. */
  askK: number;
  /** Steps that run hidden: F .. G − 1. */
  hidden: number;
  /** Highest k the timeline may reach (play, step, scrub): the frozen point. */
  maxK: number;
  /** After the answer the reveal plays k = frozenK → revealTo (the answered step included). */
  revealTo: number;
}

/** The blind window for the session's pending ask, or null when none is pending. */
export function blindView(run: Run, askIndices: readonly number[], cursor: number): BlindView | null {
  const askK = askIndices[cursor];
  if (askK === undefined) return null;
  const frozenK = frozenPoint(run, askIndices, cursor);
  return { frozenK, askK, hidden: askK - frozenK, maxK: frozenK, revealTo: askK + 1 };
}

/** The timeline gate for a session at a level: Guided and Full stop at the
 *  ask itself (session.gate, exactly as before); Blind stops at the frozen point. */
export function timelineGate(level: Level, run: Run, session: Pick<Session, 'askIndices' | 'cursor' | 'gate'>): number | null {
  if (level !== 'blind' || session.gate === null) return session.gate;
  return frozenPoint(run, session.askIndices, session.cursor);
}

/** The k at which the pending ask opens: the ask's step, or the frozen point in Blind. */
export function openAt(level: Level, run: Run, session: Pick<Session, 'askIndices' | 'cursor'>): number | null {
  const askK = session.askIndices[session.cursor];
  if (askK === undefined) return null;
  return level === 'blind' ? frozenPoint(run, session.askIndices, session.cursor) : askK;
}

/** What the narration says while steps run hidden. */
export function hiddenSentence(n: number): string {
  return n === 1 ? '1 step runs hidden. Keep the state in your head.' : `${n} steps run hidden. Keep the state in your head.`;
}

/** Delay before the reveal applies the step after `shown`. */
export function revealDelayMs(shown: Step | undefined): number {
  return playDelayMs(shown, REVEAL_SPEED);
}

/** A run whose step before k narrates `note` instead (no phase lead-in), for
 *  views that read the note from the run. States and every other step are shared. */
export function withNote(run: Run, k: number, note: string): Run {
  const step = run.steps[k - 1];
  if (!step) return run;
  const steps = run.steps.slice();
  steps[k - 1] = { line: step.line, events: step.events, note };
  return { ...run, steps };
}

// ---------------------------------------------------------------- first-time note

export const BLIND_INTRO = 'The stage freezes between questions: run the hidden steps in your head.';
const INTRO_KEY = 'dryrun.blind-intro-seen';

interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Whether the one-sentence Blind explanation was dismissed (per viewer, per
 *  browser session: it is a convenience, not a record). */
export function introSeen(store: KeyValue | null): boolean {
  try {
    return store?.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen(store: KeyValue | null): void {
  try {
    store?.setItem(INTRO_KEY, '1');
  } catch {
    // Storage blocked: the note simply shows again next time.
  }
}
