/** Shared test harness for algorithm modules (docs/ARCHITECTURE.md §12).
 *  Every module's test file composes these checks; none of them know about a
 *  specific algorithm. */

import fc from 'fast-check';
import type { AlgorithmModule } from '@/algorithms/types';
import type { Id, Step, VizEvent } from '@/engine/events';
import { ids } from '@/engine/ids';
import { apply } from '@/engine/reducer';
import type { Run } from '@/engine/run';
import { run } from '@/engine/run';
import type { State } from '@/engine/state';
import { elementAt, refToId } from '@/engine/state';

export function runModule<I>(mod: AlgorithmModule<I>, input: I): Run {
  return run(mod.initialState(input), mod.generate(input), { maxSteps: mod.meta.caps.maxSteps });
}

function fail(msg: string): never {
  throw new Error(msg);
}

/** Final result equals the plain reference implementation; no truncation. */
export function checkFinal<I>(mod: AlgorithmModule<I>, input: I, r: Run): void {
  if (r.truncated) fail(`truncated at ${mod.meta.caps.maxSteps} steps for input ${JSON.stringify(input)}`);
  const final = r.states[r.states.length - 1] as State;
  const got = JSON.stringify(mod.result(final, input));
  const want = JSON.stringify(mod.reference(input));
  if (got !== want) fail(`result ${got} != reference ${want} for input ${JSON.stringify(input)}`);
}

/** The module's invariant holds in every state. */
export function checkInvariants<I>(mod: AlgorithmModule<I>, input: I, r: Run): void {
  r.states.forEach((s, k) => {
    const problem = mod.invariantCheck(s, input);
    if (problem) fail(`invariant broken at state ${k} (${k === 0 ? 'initial' : r.steps[k - 1]?.note}): ${problem}`);
  });
}

/** Two independent runs produce identical states, and states are never
 *  mutated by later steps (snapshot taken at creation equals the stored one). */
export function checkDeterminism<I>(mod: AlgorithmModule<I>, input: I, r: Run): void {
  const again = runModule(mod, input);
  if (again.states.length !== r.states.length) fail('re-run produced a different number of states');
  let s = mod.initialState(input);
  const snapshots: string[] = [JSON.stringify(s)];
  for (const step of r.steps) {
    s = apply(s, step);
    snapshots.push(JSON.stringify(s));
  }
  r.states.forEach((st, k) => {
    const j = JSON.stringify(st);
    if (j !== snapshots[k]) fail(`state ${k} differs between replay and stored run (mutation or nondeterminism)`);
    if (j !== JSON.stringify(again.states[k])) fail(`state ${k} differs between two runs (nondeterminism)`);
  });
}

/** Every ask is well-formed and its answer is what the next step actually does. */
export function checkAsks<I>(mod: AlgorithmModule<I>, r: Run): void {
  r.steps.forEach((step, k) => {
    const ask = step.ask;
    if (!ask) return;
    const before = r.states[k] as State;
    const where = `step ${k} ("${step.note}")`;
    if (!ask.prompt.trim()) fail(`${where}: empty prompt`);
    if (!ask.rule.trim()) fail(`${where}: empty rule`);
    switch (ask.kind) {
      case 'pick': {
        if (!ask.candidates.includes(ask.answer)) fail(`${where}: answer ${ask.answer} not in candidates`);
        if (new Set(ask.candidates).size !== ask.candidates.length) fail(`${where}: duplicate candidates`);
        for (const d of ask.distractors) {
          if (d.answer === ask.answer) fail(`${where}: distractor equals answer`);
          if (!ask.candidates.includes(d.answer)) fail(`${where}: distractor ${d.answer} not clickable`);
        }
        if (!stepTouches(step, before, ask.answer)) fail(`${where}: next step does not touch pick answer ${ask.answer}`);
        break;
      }
      case 'value': {
        if (!Number.isFinite(ask.answer)) fail(`${where}: non-finite value answer`);
        for (const d of ask.distractors) if (d.answer === ask.answer) fail(`${where}: distractor equals answer`);
        break;
      }
      case 'order': {
        const pool = new Set(ask.pool);
        if (pool.size !== ask.pool.length) fail(`${where}: duplicate pool ids`);
        for (const id of ask.answer) if (!pool.has(id)) fail(`${where}: order answer ${id} not in pool`);
        if (new Set(ask.answer).size !== ask.answer.length) fail(`${where}: duplicate ids in order answer`);
        for (const d of ask.distractors) if (JSON.stringify(d.answer) === JSON.stringify(ask.answer)) fail(`${where}: distractor equals answer`);
        break;
      }
      case 'choice': {
        if (!ask.options.includes(ask.answer)) fail(`${where}: answer not in options`);
        if (new Set(ask.options).size !== ask.options.length) fail(`${where}: duplicate options`);
        for (const d of ask.distractors) {
          if (d.answer === ask.answer) fail(`${where}: distractor equals answer`);
          if (!ask.options.includes(d.answer)) fail(`${where}: distractor ${d.answer} not an option`);
        }
        break;
      }
    }
  });
  void mod;
}

/** Whether a step's events reference the given id (element, node, cell, frame, item ref). */
export function stepTouches(step: Step, before: State, id: Id): boolean {
  return step.events.some((ev) => eventTouches(ev, before, id));
}

function eventTouches(ev: VizEvent, s: State, id: Id): boolean {
  const refId = (ref: Parameters<typeof refToId>[1]): Id | null => {
    try {
      return refToId(s, ref);
    } catch {
      return null;
    }
  };
  const at = (slot: { arr: string; i: number }): Id | null => {
    try {
      const arr = s.arrays[slot.arr];
      if (!arr || slot.i < 0 || slot.i >= arr.slots.length) return null;
      return elementAt(s, slot);
    } catch {
      return null;
    }
  };
  switch (ev.t) {
    case 'compare':
      return refId(ev.a) === id || refId(ev.b) === id;
    case 'read':
    case 'skip':
    case 'mark':
      return refId(ev.ref) === id;
    case 'move':
      return ev.id === id || at(ev.to) === id;
    case 'swap':
      return at(ev.a) === id || at(ev.b) === id;
    case 'set':
    case 'clear':
      return at(ev.slot) === id;
    case 'pointer':
      return ev.at !== null && at(ev.at) === id;
    case 'push':
      return ev.item.id === id || ev.item.ref === id;
    case 'pop': {
      const item = s.panels[ev.panel]?.items.find((it) => it.id === ev.itemId);
      return ev.itemId === id || item?.ref === id;
    }
    case 'node.add':
    case 'node.detach':
    case 'node.relink':
    case 'node.remove':
    case 'node.set':
      return ev.id === id || ('parent' in ev && ev.parent === id);
    case 'edge.mark':
    case 'label':
    case 'call':
    case 'return':
      return ev.id === id;
    case 'cell':
      return ids.cell(ev.r, ev.c) === id;
    default:
      return false;
  }
}

export function checkAll<I>(mod: AlgorithmModule<I>, input: I): Run {
  const r = runModule(mod, input);
  checkFinal(mod, input, r);
  checkInvariants(mod, input, r);
  checkDeterminism(mod, input, r);
  checkAsks(mod, r);
  const decoded = mod.decode(mod.encode(input));
  if (JSON.stringify(decoded) !== JSON.stringify(input)) fail(`encode/decode round trip changed the input: ${JSON.stringify(input)} → ${JSON.stringify(decoded)}`);
  return r;
}

/** Property test over an arbitrary: runs checkAll on `numRuns` random inputs. */
export function propertyTest<I>(mod: AlgorithmModule<I>, arb: fc.Arbitrary<I>, numRuns = 1000): void {
  fc.assert(
    fc.property(arb, (input) => {
      checkAll(mod, input);
    }),
    { numRuns },
  );
}
