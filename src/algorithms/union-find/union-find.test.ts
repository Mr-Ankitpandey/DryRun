import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import { computeLayout } from '@/engine/layout';
import { TREE_NODE_R } from '@/engine/layout/tree';
import { askIndices } from '@/engine/run';
import type { TNodePrim } from '@/engine/scene';
import { buildScene, primsOf } from '@/engine/scene';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { UfInput, UfResult } from './index';
import { reference, unionFind } from './index';
import { hasRankTie } from './input';
import { runOps } from './model';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);
const preset = (id: string): UfInput => must(unionFind.presets.find((p) => p.id === id)).input;

const arb: fc.Arbitrary<UfInput> = fc.integer({ min: 1, max: 10 }).chain((n) =>
  fc.record({
    n: fc.constant(n),
    ops: fc.array(
      fc.oneof(
        fc.record({ t: fc.constant('u' as const), a: fc.nat(n - 1), b: fc.nat(n - 1) }),
        fc.record({ t: fc.constant('f' as const), x: fc.nat(n - 1) }),
      ),
      { minLength: 1, maxLength: 12 },
    ),
  }),
);

describe('union-find module', () => {
  it('passes every preset', () => {
    for (const p of unionFind.presets) checkAll(unionFind, p.input);
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(unionFind, arb, 1000);
  });

  it('step 0 shows the forest and parent[]: every element its own root, rank 0', () => {
    const s0 = must(runModule(unionFind, preset('separate')).states[0]);
    expect(s0.forest).toBe(true);
    expect(Object.values(s0.tree).map((n) => [n.id, n.parent, n.text])).toEqual([
      ['n:0', null, 'rank 0'],
      ['n:1', null, 'rank 0'],
      ['n:2', null, 'rank 0'],
      ['n:3', null, 'rank 0'],
      ['n:4', null, 'rank 0'],
      ['n:5', null, 'rank 0'],
    ]);
    expect(s0.arrays.parent?.slots.map((id) => s0.elements[id ?? '']?.value)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('a union of two singletons: finds, same-set check, tie rule, link, rank', () => {
    const r = runModule(unionFind, { n: 2, ops: [{ t: 'u', a: 1, b: 0 }] });
    expect(r.steps.map((s) => s.line)).toEqual([3, 3, 9, 11, 13]);
    expect(must(r.steps[2]).ask).toMatchObject({ kind: 'choice', level: 'guided', answer: 'no' });
    const choose = must(r.steps[3]).ask;
    expect(choose).toMatchObject({ kind: 'choice', level: 'guided', options: ['0', '1'], answer: '0' });
    if (choose?.kind === 'choice') expect(choose.distractors).toEqual([{ answer: '1', kind: 'comparison', rule: expect.stringContaining('smaller id') }]);
    const link = must(r.steps[4]);
    expect(link.events.slice(0, 4)).toEqual([
      { t: 'set', slot: { arr: 'parent', i: 1 }, value: 0 },
      { t: 'node.relink', id: 'n:1', parent: 'n:0', side: null },
      { t: 'label', id: 'n:1', text: null },
      { t: 'label', id: 'n:0', text: 'rank 1' },
    ]);
    expect(link.ask).toMatchObject({ kind: 'value', level: 'full', answer: 1 });
    if (link.ask?.kind === 'value') expect(link.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([[0, 'comparison']]);
    expect(unionFind.result(lastState(r), { n: 2, ops: [] })).toEqual({ parent: [0, 0], rank: [1, null], finds: [] });
  });

  it('chain-then-find: find(7) walks three levels, asks for the root, then compresses 7 and 6', () => {
    const input = preset('chain-then-find');
    const r = runModule(unionFind, input);
    const walk = r.steps.findIndex((s) => s.note.startsWith('find(7): 7 → 6 → 4 → 0'));
    expect(walk).toBeGreaterThan(0);
    const ask = must(r.steps[walk]).ask;
    expect(ask).toMatchObject({ kind: 'pick', level: 'guided', prompt: 'Which root does find(7) reach?', answer: 'n:0' });
    if (ask?.kind === 'pick') expect(ask.distractors.map((d) => [d.answer, d.kind])).toEqual([['n:6', 'base-case'], ['n:7', 'base-case']]);
    const c1 = must(r.steps[walk + 1]);
    const c2 = must(r.steps[walk + 2]);
    expect(c1.events).toEqual([
      { t: 'set', slot: { arr: 'parent', i: 7 }, value: 0 },
      { t: 'node.relink', id: 'n:7', parent: 'n:0', side: null },
    ]);
    expect(c1.ask).toMatchObject({ kind: 'pick', level: 'full', answer: 'n:0' });
    if (c1.ask?.kind === 'pick') expect(c1.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([['n:6', 'dependency'], ['n:4', 'dependency']]);
    expect(c2.events[1]).toEqual({ t: 'node.relink', id: 'n:6', parent: 'n:0', side: null });
    expect(must(r.steps[walk + 3]).note).toBe('find(7) returns 0.');
    const res = unionFind.result(lastState(r), input) as UfResult;
    expect(res.parent).toEqual([0, 0, 0, 2, 0, 4, 0, 0]);
    expect(res.rank).toEqual([3, null, null, null, null, null, null, null]);
    expect(res.finds).toEqual([0]);
  });

  it('a compressed node moves to its root in the forest (object constancy)', () => {
    const input = preset('chain-then-find');
    const r = runModule(unionFind, input);
    const layout = computeLayout(r, { width: 900 });
    r.steps.forEach((s, k) => {
      const relink = s.events.find((e) => e.t === 'node.relink');
      if (!relink || relink.t !== 'node.relink' || relink.parent === null) return;
      const after = buildScene(must(r.states[k + 1]), layout, { width: 900 });
      const n = after.prims.get(relink.id) as TNodePrim;
      const p = after.prims.get(relink.parent) as TNodePrim;
      expect(n.y - p.y).toBeCloseTo(layout.forest?.rowH ?? -1);
      expect(after.prims.get(`te:${relink.id}`)).toMatchObject({ parent: relink.parent });
    });
  });

  it('no tree edge runs through another node, in any state, at desktop and phone widths', () => {
    const inputs = [...unionFind.presets.map((p) => p.input)];
    for (let i = 0; i < 150; i++) inputs.push(unionFind.randomInput(createRng(`edges-${i}`), i % 2 ? 'compress' : undefined));
    let closest = Infinity;
    for (const input of inputs) {
      const r = runModule(unionFind, input);
      for (const width of [900, 2 * 24 + input.n * 44]) {
        const layout = computeLayout(r, { width });
        for (const s of r.states) {
          const scene = buildScene(s, layout, { width });
          const nodes = primsOf(scene, 'tnode');
          for (const e of primsOf(scene, 'tedge')) {
            for (const n of nodes) {
              if (n.id === e.child || n.id === e.parent) continue;
              const dx = e.x2 - e.x1;
              const dy = e.y2 - e.y1;
              const t = Math.max(0, Math.min(1, ((n.x - e.x1) * dx + (n.y - e.y1) * dy) / (dx * dx + dy * dy)));
              closest = Math.min(closest, Math.hypot(e.x1 + t * dx - n.x, e.y1 + t * dy - n.y));
            }
          }
        }
      }
    }
    expect(closest).toBeGreaterThan(TREE_NODE_R + 2);
  });

  it('already-same-set: the third union stops at "same set" with an equal-roots compare', () => {
    const r = runModule(unionFind, preset('already-same-set'));
    const same = r.steps.find((s) => s.line === 9 && s.ask?.kind === 'choice' && s.ask.answer === 'yes');
    expect(same?.note).toBe('Both roots are 0: 2 and 0 are in the same set, nothing to do.');
    expect(same?.events[0]).toEqual({ t: 'compare', a: { id: 'n:0' }, b: { id: 'n:0' }, result: '=' });
  });

  it('star: the larger rank always goes on top (the taller-tree rule)', () => {
    const r = runModule(unionFind, preset('star'));
    const chooses = r.steps.filter((s) => s.line === 10);
    expect(chooses.length).toBe(4);
    for (const s of chooses) expect(s.ask).toMatchObject({ kind: 'choice', answer: '0' });
    expect((unionFind.result(lastState(r), preset('star')) as UfResult).parent).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('every step and ask obeys the narration and ask rules on presets and random inputs', () => {
    const inputs = [...unionFind.presets.map((p) => p.input)];
    for (let i = 0; i < 60; i++) inputs.push(unionFind.randomInput(createRng(`n-${i}`)));
    for (const input of inputs) {
      const r = runModule(unionFind, input);
      for (const s of r.steps) {
        expect(s.note.length, s.note).toBeLessThanOrEqual(90);
        expect(s.note).not.toMatch(/\bwe\b/i);
        if (s.ask) {
          expect(s.ask.rule.length).toBeGreaterThan(0);
          expect(s.ask.prompt.length).toBeLessThanOrEqual(90);
          for (const d of s.ask.distractors) expect(d.rule.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('guided asks exist on a typical preset', () => {
    expect(askIndices(runModule(unionFind, preset('chain-then-find')).steps, 'guided').length).toBeGreaterThanOrEqual(8);
  });

  it('stays under the step cap; the worst case is measured', () => {
    let max = 0;
    const consider = (input: UfInput) => {
      const r = runModule(unionFind, input);
      expect(r.truncated).toBe(false);
      max = Math.max(max, r.steps.length);
    };
    fc.assert(fc.property(arb, consider), { numRuns: 3000, seed: 17 });
    for (let i = 0; i < 300; i++) consider(unionFind.randomInput(createRng(`cap-${i}`), 'compress'));
    // Hand-made worst: build two rank-2 trees on 8 nodes, join them, then
    // unions between the deepest leaves (two 3-level walks each).
    const U = (a: number, b: number) => ({ t: 'u' as const, a, b });
    consider({ n: 10, ops: [U(0, 1), U(2, 3), U(0, 2), U(4, 5), U(6, 7), U(4, 6), U(0, 4), U(3, 7), U(8, 9), U(9, 1), U(5, 8), U(3, 5)] });
    // The longest of 60,000 random 12-operation runs on 10 elements.
    consider(must(unionFind.decode({ n: '10', ops: 'u0-8,u9-7,u7-4,u2-4,u4-1,u6-9,u0-5,u5-6,u0-9,u3-0,u2-6,u1-4' })));
    expect(max).toBeLessThanOrEqual(unionFind.meta.caps.maxSteps);
    expect(max).toBe(MEASURED_MAX);
  });

  it('the scene builds for every state of every preset; ranks show under roots only', () => {
    for (const p of unionFind.presets) {
      const r = runModule(unionFind, p.input);
      const layout = computeLayout(r);
      for (const s of r.states) {
        const scene = buildScene(s, layout, { width: layout.width });
        for (const n of primsOf(scene, 'tnode')) expect(n.text !== undefined).toBe(s.tree[n.id]?.parent === null);
      }
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'compress', 'same-set', 'tie']) {
      for (let s = 0; s < 10; s++) {
        const a = unionFind.randomInput(createRng(`seed-${s}`), target);
        expect(unionFind.randomInput(createRng(`seed-${s}`), target)).toEqual(a);
        expect(unionFind.validate(unionFind.encode(a)).ok).toBe(true);
        const { stats } = runOps(a);
        if (target === 'compress') expect(stats.compressions).toBeGreaterThan(0);
        if (target === 'same-set') expect(stats.sameSet).toBeGreaterThan(0);
        if (target === 'tie') expect(hasRankTie(a)).toBe(true);
        expect(reference(a).parent).toHaveLength(a.n);
        checkAll(unionFind, a);
      }
    }
  });

  it('validates with actionable sentences', () => {
    expect(unionFind.validate({ n: '4', ops: 'u0-1,f3' })).toEqual({ ok: true, input: { n: 4, ops: [{ t: 'u', a: 0, b: 1 }, { t: 'f', x: 3 }] } });
    expect(unionFind.validate({ n: '4', ops: '' })).toEqual({ ok: false, error: 'Add at least one operation: u0-1 joins 0 and 1, f2 finds the root of 2.' });
    expect(unionFind.validate({ n: '4', ops: 'u0,1' })).toEqual({ ok: false, error: 'Operations look like u0-1 (union) or f2 (find), separated by commas (got "u0").' });
    expect(unionFind.validate({ n: '4', ops: 'u0-7' })).toEqual({ ok: false, error: 'u0-7 uses 7, outside 0–3.' });
    expect(unionFind.validate({ n: '11', ops: 'f0' })).toEqual({ ok: false, error: 'n must be between 1 and 10 (got 11).' });
    expect(unionFind.validate({ n: '', ops: 'f0' })).toMatchObject({ ok: false, error: expect.stringContaining('number of elements') });
    expect(unionFind.validate({ n: '3', ops: Array.from({ length: 13 }, () => 'f0').join(',') })).toEqual({ ok: false, error: 'Use at most 12 operations (got 13).' });
    expect(unionFind.encode({ n: 3, ops: [{ t: 'u', a: 2, b: 0 }, { t: 'f', x: 1 }] })).toEqual({ n: '3', ops: 'u2-0,f1' });
  });
});

/** Longest run found (a union costs at most 9 steps, a find 4; 12 operations
 *  never get near 12 × 9, because deep paths take many unions to build and
 *  compression flattens them). The cap, 90, leaves 50 % headroom. */
const MEASURED_MAX = 59;
