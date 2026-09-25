import { describe, expect, it } from 'vitest';
import { binarySearch } from '@/algorithms/binary-search';
import { bst } from '@/algorithms/bst';
import { dijkstra } from '@/algorithms/dijkstra';
import { quickSort } from '@/algorithms/quick-sort';
import { insertionSort } from '@/algorithms/insertion-sort';
import { mergeSort } from '@/algorithms/merge-sort';
import { bfs } from '@/algorithms/bfs';
import { knapsack } from '@/algorithms/knapsack';
import type { AlgorithmModule } from '@/algorithms/types';
import type { Step } from '@/engine/events';
import { run } from '@/engine/run';
import { emptyState, withArray } from '@/engine/state';
import { computeLayout } from '@/engine/layout';
import { buildScene } from '@/engine/scene';
import type { Ask } from '@/trace/asks';
import { createSession, submit } from '@/trace/session';
import { durations } from '@/ui/motion';
import { READ_MS, answerText, resolveTransient, formatNumber, hintOrder, invariantParts, keyHints, layoutFor, layoutWidth, mistakesByKind, playDelayMs, poolOrder, scoreLine, stepMotionMs } from './logic';

const step = (events: Step['events']): Step => ({ line: 1, events, note: '' });

describe('play timing', () => {
  it('sizes a step by its longest kind of motion', () => {
    expect(stepMotionMs(step([{ t: 'swap', a: { arr: 'a', i: 0 }, b: { arr: 'a', i: 1 } }]))).toBe(durations.l);
    expect(stepMotionMs(step([{ t: 'pointer', name: 'lo', at: { arr: 'a', i: 1 } }, { t: 'compare', a: { var: 'x' }, b: { var: 'y' } }]))).toBe(durations.m);
    expect(stepMotionMs(step([{ t: 'compare', a: { var: 'x' }, b: { var: 'y' } }]))).toBe(durations.s);
    expect(stepMotionMs(step([]))).toBe(durations.s);
    expect(stepMotionMs(undefined)).toBe(durations.s);
  });
  it('adds reading time and divides by speed', () => {
    const s = step([{ t: 'move', id: 'e:0', to: { arr: 'a', i: 1 } }]);
    expect(playDelayMs(s, 1)).toBe(durations.l + READ_MS);
    expect(playDelayMs(s, 2)).toBe(Math.round((durations.l + READ_MS) / 2));
    expect(playDelayMs(s, 0.5)).toBe((durations.l + READ_MS) * 2);
  });
  it('answers the first tick after pressing play at once', () => {
    expect(playDelayMs(undefined, 1, true)).toBe(durations.xs);
  });
});

describe('pick hints', () => {
  const pos: Record<string, { x: number; y: number }> = { a: { x: 30, y: 0 }, b: { x: 10, y: 50 }, c: { x: 10, y: 10 }, d: { x: 90, y: 0 } };
  it('orders candidates left to right, then top to bottom', () => {
    expect(hintOrder(['a', 'b', 'c', 'd'], (id) => pos[id] ?? null)).toEqual(['c', 'b', 'a', 'd']);
  });
  it('puts unknown positions last, by id', () => {
    expect(hintOrder(['z', 'a', 'y'], (id) => pos[id] ?? null)).toEqual(['a', 'y', 'z']);
  });
  it('numbers only the first nine', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `e:${i}`);
    const hints = keyHints(ids);
    expect(hints.get('e:0')).toBe(1);
    expect(hints.get('e:8')).toBe(9);
    expect(hints.has('e:9')).toBe(false);
  });
  it('matches array index order for a real binary-search ask', () => {
    const input = binarySearch.presets[0]?.input;
    if (!input) throw new Error('no preset');
    const r = run(binarySearch.initialState(input), binarySearch.generate(input));
    const layout = layoutFor(r, 'desktop');
    const k = r.steps.findIndex((s) => s.ask?.kind === 'pick');
    const ask = r.steps[k]?.ask;
    if (!ask || ask.kind !== 'pick') throw new Error('no pick');
    const scene = buildScene(r.states[k] as never, layout, { width: layout.width });
    const order = hintOrder(ask.candidates, (id) => {
      const p = scene.prims.get(id);
      return p && 'x' in p ? { x: p.x, y: p.y } : null;
    });
    expect(order).toEqual([...ask.candidates].sort((x, y) => Number(x.slice(2)) - Number(y.slice(2))));
  });
});

describe('labels', () => {
  it('prints a real minus sign', () => {
    expect(formatNumber(-1)).toBe('−1');
    expect(formatNumber(4)).toBe('4');
  });
  it('offers an order pool by label, not in answer order', () => {
    const labels: Record<string, string> = { 'n:10': '10', 'n:2': '2', 'n:7': '7' };
    expect(poolOrder(['n:7', 'n:10', 'n:2'], (id) => labels[id] ?? id)).toEqual(['n:2', 'n:7', 'n:10']);
  });
  it('names answers the way a learner says them', () => {
    const input = binarySearch.presets[0]?.input;
    if (!input) throw new Error('no preset');
    const r = run(binarySearch.initialState(input), binarySearch.generate(input));
    const layout = layoutFor(r, 'desktop');
    const scene = buildScene(r.states[2] as never, layout, { width: layout.width });
    const pick: Ask = { kind: 'pick', prompt: '', level: 'guided', rule: '', answer: 'e:4', candidates: ['e:4'], distractors: [] };
    expect(answerText(pick, 'e:4', scene)).toBe('a[4] = 15');
    const value: Ask = { kind: 'value', prompt: '', level: 'guided', rule: '', answer: -1, distractors: [] };
    expect(answerText(value, -1, null)).toBe('−1');
  });
});

describe('layout width', () => {
  const mods = [binarySearch, quickSort, dijkstra, bst, insertionSort, mergeSort, bfs, knapsack] as unknown as AlgorithmModule<unknown>[];
  it('is compact for small arrays and never exceeds 900', () => {
    const input = binarySearch.presets[0]?.input;
    if (!input) throw new Error('no preset');
    const r = run(binarySearch.initialState(input), binarySearch.generate(input));
    expect(layoutWidth(r, 'desktop')).toBe(2 * 24 + 9 * 56);
    expect(layoutWidth(r, 'mobile')).toBe(Math.max(320, 2 * 24 + 9 * 40));
  });
  it('keeps every preset of every module inside [320, 900] and stable per call', () => {
    for (const mod of mods) {
      for (const p of mod.presets) {
        const r = run(mod.initialState(p.input), mod.generate(p.input), { maxSteps: mod.meta.caps.maxSteps });
        for (const form of ['mobile', 'desktop'] as const) {
          const w = layoutWidth(r, form);
          expect(w).toBeGreaterThanOrEqual(320);
          expect(w).toBeLessThanOrEqual(900);
          expect(layoutWidth(r, form)).toBe(w);
        }
        expect(layoutWidth(r, 'mobile')).toBeLessThanOrEqual(layoutWidth(r, 'desktop'));
      }
    }
  });
});

describe('invariant sentence', () => {
  it('shows live values for the variables it names', () => {
    expect(invariantParts('If x is present, it is inside [lo, hi].', { lo: 2, hi: 8, x: 42, mid: 4 })).toEqual([
      { text: 'If ' },
      { name: 'x', value: '42' },
      { text: ' is present, it is inside [' },
      { name: 'lo', value: '2' },
      { text: ', ' },
      { name: 'hi', value: '8' },
      { text: '].' },
    ]);
  });
  it('gives a repeated name its value only once', () => {
    expect(invariantParts('i + 1 and i', { i: 3 })).toEqual([{ name: 'i', value: '3' }, { text: ' + 1 and ' }, { name: 'i', value: null }]);
  });
  it('leaves the sentence alone before the variables exist', () => {
    expect(invariantParts('If x is present, it is inside [lo, hi].', {})).toEqual([{ text: 'If x is present, it is inside [lo, hi].' }]);
  });
  it('does not match inside words or bookkeeping names', () => {
    expect(invariantParts('Left of i + 1 is < pivot.', { i: -1, 'dist:0': 3 })).toEqual([{ text: 'Left of ' }, { name: 'i', value: '−1' }, { text: ' + 1 is < pivot.' }]);
  });
});

describe('summary', () => {
  it('groups wrong answers by kind with their rules', () => {
    const input = binarySearch.presets[0]?.input;
    if (!input) throw new Error('no preset');
    const r = run(binarySearch.initialState(input), binarySearch.generate(input));
    let s = createSession(r, 'guided', { algorithm: 'binary-search', variant: 'classic', seed: 's', input: '', startedAt: 0 });
    // first ask: mid pick; answer wrong with the ceil distractor, then right
    const first = r.steps[s.gate ?? 0]?.ask;
    if (!first || first.kind !== 'pick') throw new Error('expected a pick');
    const d = first.distractors[0];
    if (!d) throw new Error('expected a distractor');
    s = submit(s, d.answer, 1).session;
    const second = r.steps[s.gate ?? 0]?.ask;
    if (!second) throw new Error('expected a second ask');
    s = submit(s, second.answer, 2).session;
    const groups = mistakesByKind(s);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe(d.kind);
    expect(groups[0]?.count).toBe(1);
    expect(groups[0]?.rules).toEqual([d.rule]);
    expect(scoreLine(2, 1)).toBe('1 of 2 right (50 %)');
    expect(scoreLine(0, 0)).toBeNull();
  });
});

describe('transient refs', () => {
  it('pins a compare on slots to the elements that were there when it happened', () => {
    const initial = withArray(emptyState(), 'a', [5, 2]);
    const steps: Step[] = [{ line: 1, note: '', events: [{ t: 'compare', a: { arr: 'a', i: 0 }, b: { arr: 'a', i: 1 }, result: '>' }, { t: 'swap', a: { arr: 'a', i: 0 }, b: { arr: 'a', i: 1 } }] }];
    const r = run(initial, steps);
    const layout = computeLayout(r);
    const after = r.states[1];
    if (!after) throw new Error('no state');
    const naive = buildScene(after, layout, { width: layout.width });
    expect(naive.prims.has('cmp:e:1:e:0')).toBe(true); // resolved after the swap: the wrong way round
    const fixed = buildScene(resolveTransient(r.states[0], steps[0], after), layout, { width: layout.width });
    expect(fixed.prims.has('cmp:e:0:e:1')).toBe(true);
    expect(fixed.prims.has('cmp:e:1:e:0')).toBe(false);
  });
  it('returns the state untouched when nothing names a slot', () => {
    const initial = withArray(emptyState(), 'a', [1]);
    const steps: Step[] = [{ line: 1, note: '', events: [{ t: 'read', ref: { id: 'e:0' } }] }];
    const r = run(initial, steps);
    expect(resolveTransient(r.states[0], steps[0], r.states[1] as never)).toBe(r.states[1]);
  });
});
