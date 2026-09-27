import { describe, expect, it } from 'vitest';
import { bfs } from '@/algorithms/bfs';
import { binarySearch } from '@/algorithms/binary-search';
import { bst } from '@/algorithms/bst';
import { dijkstra } from '@/algorithms/dijkstra';
import { insertionSort } from '@/algorithms/insertion-sort';
import { knapsack } from '@/algorithms/knapsack';
import { mergeSort } from '@/algorithms/merge-sort';
import { quickSort } from '@/algorithms/quick-sort';
import type { AlgorithmModule } from '@/algorithms/types';
import type { Run } from '@/engine/run';
import { run } from '@/engine/run';
import { buildScene } from '@/engine/scene';
import type { State } from '@/engine/state';
import { createTimeline, timelineReducer } from '@/engine/timeline';
import { createRng } from '@/lib/rng';
import type { Level } from '@/lib/storage';
import { grade } from '@/trace/grade';
import type { Session } from '@/trace/session';
import { createSession, currentAsk, submit } from '@/trace/session';
import {
  BLIND_INTRO,
  askIdOf,
  blindView,
  drawsStructures,
  frozenAsk,
  frozenPoint,
  frozenTargets,
  hiddenSentence,
  introSeen,
  isSlotPick,
  markIntroSeen,
  onStage,
  openAt,
  revealDelayMs,
  timelineGate,
  withNote,
} from './blind';
import { layoutFor, playDelayMs, scoreLine } from './logic';

const MODULES = [binarySearch, quickSort, dijkstra, bst, insertionSort, mergeSort, bfs, knapsack] as unknown as AlgorithmModule<unknown>[];
const meta = { algorithm: 'x', variant: 'v', seed: 's', input: '', startedAt: 0 };

function runOf(mod: AlgorithmModule<unknown>, input: unknown): Run {
  return run(mod.initialState(input), mod.generate(input), { maxSteps: mod.meta.caps.maxSteps });
}

/** Presets plus seeded random inputs. */
function inputsOf(mod: AlgorithmModule<unknown>, random = 40): unknown[] {
  const out = mod.presets.map((p) => p.input);
  for (let i = 0; i < random; i++) out.push(mod.randomInput(createRng(`blind-${mod.meta.id}-${i}`)));
  return out;
}

/** Answers every ask right, returning the session after each answer (cursor 0 … n). */
function sessions(r: Run, level: Level): Session[] {
  let s = createSession(r, level, meta);
  const out = [s];
  for (let cur = currentAsk(s); cur; cur = currentAsk(s)) {
    s = submit(s, cur.ask.answer, 0).session;
    out.push(s);
  }
  return out;
}

const st = (r: Run, k: number): State => {
  const s = r.states[k];
  if (!s) throw new Error(`no state ${k}`);
  return s;
};

describe('blind window on real runs of all eight modules', () => {
  for (const mod of MODULES) {
    it(`${mod.meta.id}: frozen point, hidden range, pick targets and translation`, () => {
      for (const input of inputsOf(mod)) {
        const r = runOf(mod, input);
        const layout = layoutFor(r, 'desktop');
        const guided = createSession(r, 'guided', meta);
        const blind = createSession(r, 'blind', meta);
        expect(blind.askIndices).toEqual(guided.askIndices);
        for (let cursor = 0; cursor <= blind.askIndices.length; cursor++) {
          const view = blindView(r, blind.askIndices, cursor);
          const g = blind.askIndices[cursor];
          if (g === undefined) {
            expect(view).toBeNull();
            expect(frozenPoint(r, blind.askIndices, cursor)).toBe(r.steps.length);
            continue;
          }
          if (!view) throw new Error('expected a view');
          const prev = blind.askIndices[cursor - 1];
          const earliest = prev === undefined ? 0 : prev + 1;
          expect(view.askK).toBe(g);
          expect(view.frozenK).toBeGreaterThanOrEqual(earliest);
          expect(view.frozenK).toBeLessThanOrEqual(g);
          expect(view.hidden).toBe(g - view.frozenK);
          expect(view.maxK).toBe(view.frozenK);
          expect(view.revealTo).toBe(g + 1);
          const ask = r.steps[g]?.ask;
          if (!ask) throw new Error('no ask');
          const frozen = st(r, view.frozenK);
          const atAsk = st(r, g);
          expect(drawsStructures(frozen, atAsk)).toBe(true);
          if (ask.kind !== 'pick') {
            // Only missing structures move the frozen point of a non-pick ask, and only as far as needed.
            if (view.frozenK > earliest) expect(drawsStructures(st(r, view.frozenK - 1), atAsk)).toBe(false);
            continue;
          }
          const targets = frozenTargets(ask, frozen, atAsk);
          if (!targets) throw new Error(`${mod.meta.id}: pick at ${g} has no targets on the frozen stage`);
          // Every target is drawn on the frozen stage (onStage agrees with the scene builder).
          const scene = buildScene(frozen, layout, { width: layout.width });
          for (const id of targets) expect(scene.prims.has(id), `${id} drawn at k=${view.frozenK}`).toBe(true);
          // The frozen point moves only as far as it must.
          if (view.frozenK > earliest) {
            const before = st(r, view.frozenK - 1);
            expect(frozenTargets(ask, before, atAsk) === null || !drawsStructures(before, atAsk)).toBe(true);
          }
          // Targets are distinct and translate one to one onto the candidates.
          expect(new Set(targets).size).toBe(targets.length);
          expect(new Set(targets.map((id) => askIdOf(ask, id, frozen, atAsk)))).toEqual(new Set(ask.candidates));
          // Clicking the answer as the learner sees it grades right; any other target grades wrong.
          const shown = frozenAsk(ask, frozen, atAsk);
          if (shown.kind !== 'pick') throw new Error('frozenAsk changed the kind');
          expect(shown.candidates).toEqual(targets);
          expect(grade(ask, askIdOf(ask, shown.answer, frozen, atAsk)).correct).toBe(true);
          for (const id of targets) if (id !== shown.answer) expect(grade(ask, askIdOf(ask, id, frozen, atAsk)).correct).toBe(false);
        }
      }
    });
  }

  it('onStage matches what the scene draws for every pick candidate', () => {
    for (const mod of MODULES) {
      const input = mod.presets[0]?.input;
      const r = runOf(mod, input);
      const layout = layoutFor(r, 'desktop');
      const candidates = new Set(r.steps.flatMap((s) => (s.ask?.kind === 'pick' ? s.ask.candidates : [])));
      r.states.forEach((state, k) => {
        if (k % 3 !== 0) return;
        const scene = buildScene(state, layout, { width: layout.width });
        for (const id of candidates) expect(onStage(state, id), `${mod.meta.id} ${id} at ${k}`).toBe(scene.prims.has(id));
      });
    }
  });
});

describe('guided and full are unchanged', () => {
  it('the timeline gate and the open point are the session gate and the ask step, byte for byte', () => {
    for (const mod of MODULES) {
      for (const input of inputsOf(mod, 10)) {
        const r = runOf(mod, input);
        for (const level of ['guided', 'full'] as const) {
          for (const s of sessions(r, level)) {
            expect(timelineGate(level, r, s)).toBe(s.gate);
            expect(openAt(level, r, s)).toBe(s.askIndices[s.cursor] ?? null);
          }
        }
      }
    }
  });
});

describe('what blind asks', () => {
  function pickPrompts(mod: AlgorithmModule<unknown>): { slot: Set<string>; identity: Set<string> } {
    const slot = new Set<string>();
    const identity = new Set<string>();
    for (const input of inputsOf(mod, 10)) {
      const r = runOf(mod, input);
      for (const g of createSession(r, 'blind', meta).askIndices) {
        const ask = r.steps[g]?.ask;
        if (ask?.kind !== 'pick') continue;
        const generic = ask.prompt.replace(/.*\. /, '').replace(/-?\d+/g, '#');
        (isSlotPick(ask, st(r, g)) ? slot : identity).add(generic);
      }
    }
    return { slot, identity };
  }

  it('only "where" picks on arrays are slot picks', () => {
    expect(pickPrompts(binarySearch as unknown as AlgorithmModule<unknown>).slot).toEqual(new Set(['Where does mid land?', 'Where does lo move?', 'Where does hi move?']));
    expect(pickPrompts(quickSort as unknown as AlgorithmModule<unknown>)).toEqual({ slot: new Set(['Where does the pivot # land?']), identity: new Set() });
    for (const mod of [insertionSort, mergeSort, bst, dijkstra, bfs, knapsack] as unknown as AlgorithmModule<unknown>[]) expect(pickPrompts(mod).slot).toEqual(new Set());
  });

  it('quick sort hides whole partitions, and the pivot pick is by slot on the frozen stage', () => {
    const input = quickSort.presets[0]?.input;
    const r = runOf(quickSort as unknown as AlgorithmModule<unknown>, input);
    const s = createSession(r, 'blind', meta);
    const views = s.askIndices.map((_, c) => blindView(r, s.askIndices, c));
    const hidden = views.map((v) => v?.hidden ?? 0);
    expect(Math.max(...hidden)).toBeGreaterThanOrEqual(8);
    // Some pivot lands on a slot whose element on the frozen stage is not the
    // element there at the ask: the learner clicks the slot, not the element.
    let moved = 0;
    for (const v of views) {
      if (!v) continue;
      const ask = r.steps[v.askK]?.ask;
      if (ask?.kind !== 'pick') continue;
      const shown = frozenAsk(ask, st(r, v.frozenK), st(r, v.askK));
      if (shown.kind === 'pick' && shown.answer !== ask.answer) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });

  it('bst builds visibly up to the first node a pick needs', () => {
    const r = runOf(bst as unknown as AlgorithmModule<unknown>, bst.presets[0]?.input);
    const s = createSession(r, 'blind', meta);
    const v = blindView(r, s.askIndices, 0);
    const first = s.askIndices[0] ?? -1;
    const ask = r.steps[first]?.ask;
    if (!v || ask?.kind !== 'pick') throw new Error('expected a pick first');
    expect(v.frozenK).toBeGreaterThan(0);
    expect(ask.candidates.every((id) => onStage(st(r, v.frozenK), id))).toBe(true);
  });
});

describe('blind timeline', () => {
  it('play, step, seek and scrub stop at the frozen point; answering reveals through the answered step', () => {
    const r = runOf(quickSort as unknown as AlgorithmModule<unknown>, quickSort.presets[0]?.input);
    let s = createSession(r, 'blind', meta);
    let t = createTimeline(r.steps.length, timelineGate('blind', r, s));
    for (let c = 0; c < s.askIndices.length; c++) {
      const v = blindView(r, s.askIndices, s.cursor);
      if (!v) throw new Error('no view');
      // Play or step as far as it goes: the frozen point.
      t = timelineReducer(t, { type: 'play' });
      for (let i = 0; i < 700 && t.k < t.length; i++) t = timelineReducer(t, { type: 'next' });
      expect(t.k).toBe(v.frozenK);
      expect(t.playing).toBe(false);
      for (const a of [{ type: 'seek', k: r.steps.length } as const, { type: 'scrub', k: v.askK } as const]) {
        expect(timelineReducer(t, a).k).toBe(v.frozenK);
      }
      expect(openAt('blind', r, s)).toBe(t.k);
      const cur = currentAsk(s);
      if (!cur) throw new Error('no ask');
      s = submit(s, cur.ask.answer, 0).session;
      t = timelineReducer(t, { type: 'gate', gate: s.gate === null ? null : timelineGate('blind', r, s) });
      for (let i = 0; i < v.revealTo - v.frozenK; i++) t = timelineReducer(t, { type: 'next' });
      expect(t.k).toBe(v.revealTo);
      // Revealed steps may now be scrubbed freely.
      expect(timelineReducer(t, { type: 'seek', k: v.frozenK + 1 }).k).toBe(v.frozenK + 1);
    }
    expect(s.gate).toBeNull();
  });
});

describe('blind copy and helpers', () => {
  it('narrates the hidden steps', () => {
    expect(hiddenSentence(1)).toBe('1 step runs hidden. Keep the state in your head.');
    expect(hiddenSentence(7)).toBe('7 steps run hidden. Keep the state in your head.');
    expect(BLIND_INTRO).toBe('The stage freezes between questions: run the hidden steps in your head.');
  });
  it('replaces one note without touching the run', () => {
    const r = runOf(binarySearch as unknown as AlgorithmModule<unknown>, binarySearch.presets[0]?.input);
    const w = withNote(r, 3, 'hidden');
    expect(w.steps[2]?.note).toBe('hidden');
    expect(w.steps[2]?.phase).toBeUndefined();
    expect(w.steps[2]?.line).toBe(r.steps[2]?.line);
    expect(r.steps[2]?.note).not.toBe('hidden');
    expect(w.states).toBe(r.states);
    expect(withNote(r, 0, 'x')).toBe(r);
  });
  it('reveals at twice the play speed', () => {
    const step = { line: 1, note: '', events: [{ t: 'swap' as const, a: { arr: 'a', i: 0 }, b: { arr: 'a', i: 1 } }] };
    expect(revealDelayMs(step)).toBe(playDelayMs(step, 2));
    expect(revealDelayMs(step)).toBeLessThan(playDelayMs(step, 1));
  });
  it('names the blind level in the score line only', () => {
    expect(scoreLine(7, 5, 'blind')).toBe('Blind: 5 of 7 right (71 %)');
    expect(scoreLine(7, 5, 'guided')).toBe('5 of 7 right (71 %)');
    expect(scoreLine(7, 5)).toBe('5 of 7 right (71 %)');
    expect(scoreLine(0, 0, 'blind')).toBeNull();
  });
  it('remembers the first-time note per browser session and survives blocked storage', () => {
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(introSeen(store)).toBe(false);
    markIntroSeen(store);
    expect(introSeen(store)).toBe(true);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(introSeen(blocked)).toBe(false);
    expect(() => markIntroSeen(blocked)).not.toThrow();
    expect(introSeen(null)).toBe(false);
  });
});
