import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import { askIndices } from '@/engine/run';
import { createRng } from '@/lib/rng';
import type { State } from '@/engine/state';
import type { BstInput } from './index';
import { bst, reference } from './index';
import { plainBuild, plainDepth, plainInsert } from './input';

const keysArb = fc.uniqueArray(fc.integer({ min: 0, max: 99 }), { maxLength: 15 }).filter((keys) => plainDepth(plainBuild(keys)) <= 5);
const arb: fc.Arbitrary<BstInput> = fc
  .record({
    keys: keysArb,
    op: fc.constantFrom<'insert' | 'search' | 'delete'>('insert', 'search', 'delete'),
    x: fc.integer({ min: 0, max: 99 }),
    present: fc.boolean(),
    idx: fc.nat(),
  })
  .map(({ keys, op, x, present, idx }) => ({ keys, op, x: present && keys.length > 0 ? (keys[idx % keys.length] as number) : x }))
  .filter((input) => input.op !== 'insert' || plainDepth(plainInsert(plainBuild(input.keys), input.x)) <= 5);

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);

function askOf(input: BstInput, kind: string, promptPart: string) {
  const r = runModule(bst, input);
  return r.steps.map((s) => s.ask).filter((a) => a && a.kind === kind && a.prompt.includes(promptPart));
}

describe('bst module', () => {
  it('passes every preset', () => {
    for (const p of bst.presets) checkAll(bst, p.input);
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(bst, arb, 1000);
  });

  it('reference: in-order after the op is the sorted key set with x added / removed', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = reference(input);
        const set = new Set(input.keys);
        if (input.op === 'insert') set.add(input.x);
        if (input.op === 'delete') set.delete(input.x);
        expect(r.inorder).toEqual([...set].sort((a, b) => a - b));
        expect(r.found).toBe(input.keys.includes(input.x));
      }),
    );
  });

  it('build prelude: one node.add per key, in input order, no asks', () => {
    const r = runModule(bst, { keys: [8, 3, 10, 1, 6], op: 'search', x: 6 });
    const build = r.steps.filter((s) => s.phase === 'build');
    expect(build).toHaveLength(5);
    build.forEach((s, i) => {
      expect(s.events).toHaveLength(1);
      expect(s.events[0]).toMatchObject({ t: 'node.add', key: [8, 3, 10, 1, 6][i] });
      expect(s.ask).toBeUndefined();
    });
    expect(build[4]?.note).toBe('Insert 6: 6 < 8 left, 6 > 3 right; attach as right child of 3.');
    expect(r.states[5]?.root).toBe('n:8');
  });

  it('search: walks the path with one active mark per node and asks the next node', () => {
    const r = runModule(bst, { keys: [8, 3, 10, 1, 6], op: 'search', x: 6 });
    const walk = r.steps.filter((s) => s.phase === 'search');
    // start, 8, 3, 6, found
    expect(walk.map((s) => s.line)).toEqual([6, 9, 10, 8, 8]);
    const asks = walk.map((s) => s.ask).filter(Boolean);
    expect(asks).toHaveLength(2);
    expect(asks[0]).toMatchObject({ kind: 'pick', answer: 'n:3', candidates: ['n:3', 'n:10'] });
    expect(asks[0]?.kind === 'pick' && asks[0].distractors[0]?.answer).toBe('n:10');
    expect(asks[1]).toMatchObject({ kind: 'pick', answer: 'n:6', candidates: ['n:1', 'n:6'] });
    const final = r.states[r.states.length - 1];
    expect(final?.tree['n:6']?.mark).toBe('done');
    expect(bst.result(must(final), { keys: [8, 3, 10, 1, 6], op: 'search', x: 6 })).toEqual({ inorder: [1, 3, 6, 8, 10], path: [8, 3, 6], found: true });
  });

  it('search miss ends at an empty slot with found = false', () => {
    const r = runModule(bst, { keys: [8, 3, 10, 1, 6, 14], op: 'search', x: 7 });
    const final = r.states[r.states.length - 1];
    expect(final?.vars.found).toBe(false);
    expect(final?.vars.path).toBe('8,3,6');
    expect(r.steps[r.steps.length - 1]?.line).toBe(7);
  });

  it('insert attaches under the last compared node with the right side', () => {
    const r = runModule(bst, { keys: [9, 7, 5, 3], op: 'insert', x: 1 });
    const final = lastState(r);
    expect(final.tree['n:1']).toMatchObject({ parent: 'n:3', left: null, right: null, mark: 'done' });
    expect(final.tree['n:3']?.left).toBe('n:1');
    const rEmpty = runModule(bst, { keys: [], op: 'insert', x: 5 });
    expect(rEmpty.states[rEmpty.states.length - 1]?.root).toBe('n:5');
    const rDup = runModule(bst, { keys: [8, 3, 10], op: 'insert', x: 3 });
    expect(Object.keys(lastState(rDup).tree)).toHaveLength(3);
    expect(rDup.steps[rDup.steps.length - 1]?.note).toContain('already in the tree');
  });

  it('delete leaf: one step with node.remove and the case ask', () => {
    const r = runModule(bst, { keys: [8, 3, 10, 1, 6, 14], op: 'delete', x: 1 });
    const del = r.steps.filter((s) => s.phase === 'delete');
    const last = must(del[del.length - 1]);
    expect(last.events).toContainEqual({ t: 'node.remove', id: 'n:1' });
    expect(last.ask).toMatchObject({ kind: 'choice', answer: 'leaf', options: ['leaf', 'one child', 'two children'] });
    expect(last.line).toBe(10);
    expect(r.states[r.states.length - 1]?.tree['n:3']?.left).toBeNull();
  });

  it('delete one child: detach → relink child to grandparent → remove, with the relink ask', () => {
    const r = runModule(bst, { keys: [8, 3, 10, 1, 6, 14, 13], op: 'delete', x: 10 });
    const del = r.steps.filter((s) => s.phase === 'delete');
    const a = must(del[del.length - 2]);
    const b = must(del[del.length - 1]);
    expect(a.events).toContainEqual({ t: 'node.detach', id: 'n:10' });
    expect(a.ask).toMatchObject({ kind: 'choice', answer: 'one child' });
    expect(b.events).toEqual([
      { t: 'node.relink', id: 'n:14', parent: 'n:8', side: 'R' },
      { t: 'node.remove', id: 'n:10' },
      { t: 'var', name: 'copied', value: null },
    ]);
    expect(b.ask).toMatchObject({ kind: 'pick', answer: 'n:14', level: 'full' });
    const final = lastState(r);
    expect(final.tree['n:8']?.right).toBe('n:14');
    expect(final.tree['n:14']).toMatchObject({ parent: 'n:8', left: 'n:13' });
    expect(final.tree['n:10']).toBeUndefined();
  });

  it('delete root with one child relinks the child as the new root', () => {
    const r = runModule(bst, { keys: [8, 10, 9, 14], op: 'delete', x: 8 });
    const final = lastState(r);
    expect(final.root).toBe('n:10');
    expect(final.tree['n:10']?.parent).toBeNull();
    expect(r.steps.some((s) => s.events.some((e) => e.t === 'node.relink' && e.parent === null))).toBe(true);
  });

  it('delete two children: successor ask, key copy, then successor removed by the one-child path on line 13', () => {
    const input: BstInput = { keys: [8, 3, 10, 1, 6, 14, 4, 7, 13, 5], op: 'delete', x: 3 };
    const r = runModule(bst, input);
    const succAsk = askOf(input, 'pick', 'successor')[0];
    expect(succAsk).toMatchObject({ kind: 'pick', answer: 'n:4' });
    if (succAsk?.kind === 'pick') {
      expect(succAsk.candidates.sort()).toEqual(['n:4', 'n:5', 'n:6', 'n:7']);
      expect(succAsk.distractors.map((d) => d.answer).sort()).toEqual(['n:6', 'n:7']);
    }
    const set = r.steps.find((s) => s.events.some((e) => e.t === 'node.set'));
    expect(set?.events).toContainEqual({ t: 'node.set', id: 'n:3', key: 4 });
    const after = r.steps.slice(r.steps.indexOf(must(set)) + 1);
    expect(after.map((s) => s.line)).toEqual([13, 13]);
    expect(after[0]?.ask).toMatchObject({ kind: 'choice', answer: 'one child' });
    expect(after[1]?.events).toContainEqual({ t: 'node.relink', id: 'n:5', parent: 'n:6', side: 'L' });
    const final = lastState(r);
    expect(final.tree['n:3']?.key).toBe(4);
    expect(final.tree['n:4']).toBeUndefined();
    expect(bst.result(final, input)).toEqual(reference(input));
  });

  it('delete root with two children: the right child is the successor when it has no left child', () => {
    const input: BstInput = { keys: [8, 3, 10, 1, 6, 14, 13], op: 'delete', x: 8 };
    const succAsk = askOf(input, 'pick', 'successor')[0];
    expect(succAsk).toMatchObject({ kind: 'pick', answer: 'n:10' });
    if (succAsk?.kind === 'pick') expect(succAsk.distractors.map((d) => d.answer)).toEqual(['n:14']);
    const r = runModule(bst, input);
    const final = lastState(r);
    expect(final.root).toBe('n:8');
    expect(final.tree['n:8']).toMatchObject({ key: 10, right: 'n:14' });
  });

  it('delete of a missing key shows the path and changes nothing', () => {
    const input: BstInput = { keys: [8, 3, 10], op: 'delete', x: 5 };
    const r = runModule(bst, input);
    expect(r.steps[r.steps.length - 1]?.line).toBe(7);
    expect(Object.keys(lastState(r).tree)).toHaveLength(3);
  });

  it('guided asks exist on the delete presets and every ask has a rule', () => {
    for (const p of bst.presets.filter((p) => p.id.startsWith('delete'))) {
      const r = runModule(bst, p.input);
      expect(askIndices(r.steps, 'guided').length).toBeGreaterThanOrEqual(1);
      for (const s of r.steps) if (s.ask) expect(s.ask.rule.length).toBeGreaterThan(0);
    }
  });

  it('stays under the step cap on the largest inputs', () => {
    const keys = [50, 25, 75, 12, 37, 62, 87, 6, 18, 31, 43, 56, 68, 81, 93];
    for (const op of ['insert', 'search', 'delete'] as const) {
      for (const x of [50, 6, 93, 37, 40]) {
        const r = runModule(bst, { keys, op, x });
        expect(r.truncated).toBe(false);
        expect(r.steps.length).toBeLessThanOrEqual(bst.meta.caps.maxSteps);
      }
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'two-children', 'one-child', 'leaf', 'root', 'insert', 'search', 'delete', 'miss']) {
      const a = bst.randomInput(createRng('seed-1'), target);
      const b = bst.randomInput(createRng('seed-1'), target);
      expect(a).toEqual(b);
      expect(bst.validate(bst.encode(a)).ok).toBe(true);
      if (target === 'insert' || target === 'search' || target === 'delete') expect(a.op).toBe(target);
      if (target === 'miss') expect(a.keys).not.toContain(a.x);
      if (target === 'root') expect(a.x).toBe(a.keys[0]);
      if (target === 'two-children' || target === 'one-child' || target === 'leaf') {
        expect(a.op).toBe('delete');
        const r = runModule(bst, a);
        const caseAsk = r.steps.map((s) => s.ask).find((k) => k?.kind === 'choice');
        expect(caseAsk).toMatchObject({ answer: target === 'two-children' ? 'two children' : target === 'one-child' ? 'one child' : 'leaf' });
      }
    }
    for (let i = 0; i < 20; i++) checkAll(bst, bst.randomInput(createRng(`s${i}`)));
  });

  it('rejects duplicates, deep trees, bad ops and out-of-range values with actionable errors', () => {
    expect(bst.validate({ i: '5,3,5', op: 'search', x: '3' })).toEqual({ ok: false, error: 'BSTs here hold distinct keys.' });
    expect(bst.validate({ i: '1,2,3,4,5,6,7', op: 'search', x: '3' })).toMatchObject({ ok: false });
    expect(bst.validate({ i: '1,2,3,4,5,6', op: 'insert', x: '7' })).toMatchObject({ ok: false });
    expect(bst.validate({ i: '1,2,3,4,5,6', op: 'insert', x: '0' })).toMatchObject({ ok: true });
    expect(bst.validate({ i: Array.from({ length: 16 }, (_, i) => i).join(','), op: 'search', x: '1' })).toMatchObject({ ok: false });
    expect(bst.validate({ i: '1,2', op: 'flip', x: '1' })).toMatchObject({ ok: false });
    expect(bst.validate({ i: '1,2', op: 'search', x: '100' })).toMatchObject({ ok: false });
    expect(bst.validate({ i: '1,2', op: 'search', x: 'q' })).toMatchObject({ ok: false });
    expect(bst.validate({ i: '8,3,10,1,6', op: 'delete', x: '3' })).toEqual({ ok: true, input: { keys: [8, 3, 10, 1, 6], op: 'delete', x: 3 } });
  });
});
