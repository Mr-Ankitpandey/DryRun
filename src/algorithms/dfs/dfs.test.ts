import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkAll, propertyTest, runModule } from '@/algorithms/_harness';
import type { Step } from '@/engine/events';
import { computeLayout } from '@/engine/layout';
import { askIndices } from '@/engine/run';
import { buildScene } from '@/engine/scene';
import type { State } from '@/engine/state';
import { createRng } from '@/lib/rng';
import type { DfsInput } from './index';
import { dfs, reference } from './index';
import { hasBackEdge, maxDepth, treeCount } from './input';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}
const lastState = (r: { states: State[] }): State => must(r.states[r.states.length - 1]);

const arb: fc.Arbitrary<DfsInput> = fc.integer({ min: 1, max: 10 }).chain((n) => {
  const maxEdges = Math.min(16, (n * (n - 1)) / 2);
  const edge = fc
    .record({ a: fc.integer({ min: 0, max: n - 1 }), b: fc.integer({ min: 0, max: n - 1 }) })
    .filter((e) => e.a !== e.b)
    .map((e) => (e.a < e.b ? e : { a: e.b, b: e.a }));
  return fc.record({
    n: fc.constant(n),
    edges: n < 2 ? fc.constant([]) : fc.uniqueArray(edge, { maxLength: maxEdges, selector: (e) => `${e.a}-${e.b}` }),
  });
});

const preset = (id: string): DfsInput => must(dfs.presets.find((p) => p.id === id)).input;

/** Exact step count: setup + (call, discover, finish) per node + one read per
 *  non-tree scan (2m − tree edges) + outer-loop skip runs + the final step. */
function expectedSteps(input: DfsInput): number {
  const roots = treeCount(input);
  const { d, f } = reference(input);
  let runs = 0;
  let inRun = false;
  let maxFinished = 0;
  for (let s = 0; s < input.n; s++) {
    // s is a root when no earlier tree reached it (its d is one past the last finish).
    const isRoot = (d[s] as number) === maxFinished + 1;
    if (isRoot) {
      inRun = false;
      maxFinished = Math.max(maxFinished, f[s] as number);
    } else if (!inRun) {
      runs++;
      inRun = true;
    }
  }
  return 1 + 3 * input.n + (2 * input.edges.length - (input.n - roots)) + runs + 1;
}

describe('dfs module', () => {
  it('passes every preset', () => {
    for (const p of dfs.presets) checkAll(dfs, p.input);
  });

  it('the graph is on stage at step 0, before any step runs', () => {
    for (const p of dfs.presets) {
      const r = runModule(dfs, p.input);
      const s0 = must(r.states[0]);
      expect(s0.graph?.nodes.map((x) => x.id)).toEqual(Array.from({ length: p.input.n }, (_, v) => `n:${v}`));
      expect(s0.graph?.edges.map((e) => e.id)).toEqual(p.input.edges.map((e) => `g:${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`));
      expect(s0.graph?.nodes.every((x) => x.mark === null && x.text === null)).toBe(true);
      expect(r.steps.some((s) => s.events.some((e) => e.t === 'graph'))).toBe(false); // one source: the initial state
    }
  });

  it('property: 1,000 random inputs match the reference, keep the invariant, are deterministic', () => {
    propertyTest(dfs, arb, 1000);
  });

  it('reference: parenthesis property, every time 1..2n used once, tree edges join nested intervals', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const { d, f } = reference(input);
        expect([...d, ...f].sort((x, y) => x - y)).toEqual(Array.from({ length: 2 * input.n }, (_, k) => k + 1));
        for (let v = 0; v < input.n; v++) {
          expect(d[v] as number).toBeLessThan(f[v] as number);
          for (let w = 0; w < input.n; w++) {
            if (v === w) continue;
            const [dv, fv, dw, fw] = [d[v], f[v], d[w], f[w]] as number[] as [number, number, number, number];
            expect(fv < dw || fw < dv || (dv < dw && fw < fv) || (dw < dv && fv < fw)).toBe(true);
          }
        }
        // Undirected DFS: every edge joins an ancestor and a descendant.
        for (const e of input.edges) {
          const [da, fa, db, fb] = [d[e.a], f[e.a], d[e.b], f[e.b]] as number[] as [number, number, number, number];
          expect((da < db && fb < fa) || (db < da && fa < fb)).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('tree: call, discover, read the parent, finish, and the asks in their places', () => {
    const input = preset('tree');
    const r = runModule(dfs, input);
    // 0 → 1 → 3, 4 → 2 → 5, 6 (each child reads its parent before finishing)
    expect(r.steps.map((s) => s.line)).toEqual([1, 3, 5, 8, 5, 7, 8, 5, 7, 9, 8, 5, 7, 9, 9, 8, 5, 7, 8, 5, 7, 9, 8, 5, 7, 9, 9, 9, 3, 2]);
    expect(r.steps.length).toBe(expectedSteps(input));
    expect(must(r.steps[0]).events).toEqual([{ t: 'var', name: 'time', value: 0 }]);
    expect(must(r.steps[1]).events).toEqual([
      { t: 'call', id: 'f:0', label: 'dfs(0)', args: { u: 0 }, parent: null },
      { t: 'mark', ref: { id: 'n:0' }, as: 'active' },
    ]);
    expect(must(r.steps[1]).ask).toBeUndefined(); // the first start is always node 0
    expect(must(r.steps[2]).events).toEqual([
      { t: 'var', name: 'time', value: 1 },
      { t: 'label', id: 'n:0', text: '1/' },
    ]);
    expect(must(r.steps[2]).ask).toMatchObject({ kind: 'value', level: 'guided', answer: 1 });

    const call1 = must(r.steps[3]);
    expect(call1.events).toEqual([
      { t: 'mark', ref: { id: 'n:0' }, as: 'visited' },
      { t: 'edge.mark', id: 'g:0-1', as: 'tree' },
      { t: 'call', id: 'f:1', label: 'dfs(1)', args: { u: 1 }, parent: 'f:0' },
      { t: 'mark', ref: { id: 'n:1' }, as: 'active' },
    ]);
    const pick = call1.ask;
    expect(pick).toMatchObject({ kind: 'pick', level: 'guided', answer: 'n:1', candidates: ['n:1', 'n:2', 'n:3', 'n:4', 'n:5', 'n:6'] });
    if (pick?.kind === 'pick') expect(pick.distractors.map((d) => [d.answer, d.kind])).toEqual([['n:2', 'order']]); // returning early would restart the outer loop at 1: same node

    // dfs(1) reads its parent 0 while 3 and 4 still wait: "does dfs(1) return now?" → no
    const read0 = must(r.steps[5]);
    expect(read0.events).toEqual([{ t: 'read', ref: { id: 'n:0' } }]);
    expect(read0.note).toBe("0 is 1's parent: 1-0 is the tree edge dfs came along, so skip it.");
    expect(read0.ask).toMatchObject({ kind: 'choice', answer: 'no', options: ['yes', 'no'] });

    // dfs(1) calls dfs(3): the breadth-first instinct would take 2, the largest-id neighbour is 4
    const call3 = must(r.steps[6]);
    if (call3.ask?.kind === 'pick') {
      expect(call3.ask.answer).toBe('n:3');
      expect(call3.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([['n:4', 'order'], ['n:2', 'order'], ['n:0', 'base-case']]);
    }

    // dfs(3) is a leaf: finish asks "does it return now?" → yes
    const fin3 = must(r.steps[9]);
    expect(fin3.events).toEqual([
      { t: 'var', name: 'time', value: 4 },
      { t: 'label', id: 'n:3', text: '3/4' },
      { t: 'mark', ref: { id: 'n:3' }, as: 'settled' },
      { t: 'return', id: 'f:2' },
      { t: 'mark', ref: { id: 'n:1' }, as: 'active' },
    ]);
    expect(fin3.ask).toMatchObject({ kind: 'choice', answer: 'yes' });
    // dfs(1) called children: finish asks f[1]
    const fin1 = must(r.steps[14]);
    expect(fin1.note).toBe('No unvisited neighbour is left: f[1] = 7, and dfs(1) returns to dfs(0).');
    expect(fin1.ask).toMatchObject({ kind: 'value', level: 'full', answer: 7 });
    if (fin1.ask?.kind === 'value') expect(fin1.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([[6, 'boundary'], [3, 'boundary']]);

    // the outer loop skips 1..6 in one step, then the run ends
    const skip = must(r.steps[28]);
    expect(skip.events).toHaveLength(6);
    expect(skip.note).toBe('1, 2, 3, 4, 5, 6 are already visited: the outer loop skips them.');
    expect(must(r.steps[29]).note).toBe('Every node is finished: 1 DFS tree, and the clock ends at 14.');
    expect(dfs.result(lastState(r), input)).toEqual({ d: [1, 2, 8, 3, 5, 9, 11], f: [14, 7, 13, 4, 6, 10, 12] });
    expect(lastState(r).frameOrder).toEqual([]);
  });

  it('discovery asks: d[u] with ++time, count-only and depth distractors', () => {
    const r = runModule(dfs, preset('tree'));
    // dfs(2) is discovered at time 8 (after 1's subtree): count-only says 5, depth says 2
    const disc2 = must(r.steps.find((s) => s.line === 5 && s.events.some((e) => e.t === 'label' && e.id === 'n:2')));
    expect(disc2.ask).toMatchObject({ kind: 'value', answer: 8 });
    if (disc2.ask?.kind === 'value') expect(disc2.ask.distractors.map((d) => [d.answer, d.kind])).toEqual([[7, 'boundary'], [5, 'boundary'], [2, 'boundary']]);
  });

  it('cycle: 4 meets 0 on the stack, a back edge, and the stack order is asked', () => {
    const r = runModule(dfs, preset('cycle'));
    const back = must(r.steps.find((s) => s.note.includes('back edge')));
    expect(back.note).toBe('0 is on the stack: 4-0 is a back edge to an ancestor, so skip it.');
    expect(back.events).toEqual([{ t: 'read', ref: { id: 'n:0' } }]);
    const ask = back.ask;
    expect(ask).toMatchObject({ kind: 'order', level: 'full', answer: ['n:0', 'n:1', 'n:2', 'n:3', 'n:4'] });
    // pool in id order equals the stack here, so the id-order distractor is dropped
    if (ask?.kind === 'order') expect(ask.distractors.map((d) => d.answer)).toEqual([['n:4', 'n:3', 'n:2', 'n:1', 'n:0']]);
    // 0 then reads 4, already finished (the same back edge from the other end)
    expect(r.steps.some((s) => s.note === '4 is already finished (a descendant of 0): skip it.')).toBe(true);
    expect(dfs.result(lastState(r), preset('cycle'))).toEqual({ d: [1, 2, 3, 4, 5], f: [10, 9, 8, 7, 6] });
    expect(lastState(r).graph?.edges.filter((e) => e.mark === 'tree').map((e) => e.id)).toEqual(['g:0-1', 'g:1-2', 'g:2-3', 'g:3-4']);
  });

  it('order asks: the answer is the call stack, pool is the same set in id order, id-order distractor when it differs', () => {
    // A stack out of id order.
    const input6: DfsInput = { n: 4, edges: [{ a: 0, b: 3 }, { a: 3, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 0 }] };
    const ask6 = must(runModule(dfs, input6).steps.find((s) => s.ask?.kind === 'order')).ask;
    // 0's neighbours ascending: 2 first → dfs(2) → 1 → 3 → meets 0: stack 0, 2, 1, 3
    expect(ask6).toMatchObject({ answer: ['n:0', 'n:2', 'n:1', 'n:3'], pool: ['n:0', 'n:1', 'n:2', 'n:3'] });
    if (ask6?.kind === 'order') {
      expect(ask6.distractors.map((d) => [d.answer, d.kind])).toEqual([
        [['n:3', 'n:1', 'n:2', 'n:0'], 'order'],
        [['n:0', 'n:1', 'n:2', 'n:3'], 'order'],
      ]);
    }
    fc.assert(
      fc.property(arb, (inp) => {
        const run = runModule(dfs, inp);
        run.steps.forEach((s, k) => {
          if (s.ask?.kind !== 'order') return;
          const st = must(run.states[k + 1]);
          expect(s.ask.answer).toEqual(st.frameOrder.map((fid) => `n:${String(st.frames[fid]?.args['u'])}`));
          expect(s.ask.pool).toEqual([...s.ask.answer].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))));
        });
      }),
      { numRuns: 200 },
    );
  });

  it('complete-4: back edges, an already-finished neighbour and one tree', () => {
    const r = runModule(dfs, preset('complete-4'));
    const notes = r.steps.filter((s) => s.line === 7).map((s) => s.note);
    expect(notes).toEqual([
      "0 is 1's parent: 1-0 is the tree edge dfs came along, so skip it.",
      '0 is on the stack: 2-0 is a back edge to an ancestor, so skip it.',
      "1 is 2's parent: 2-1 is the tree edge dfs came along, so skip it.",
      '0 is on the stack: 3-0 is a back edge to an ancestor, so skip it.',
      '1 is on the stack: 3-1 is a back edge to an ancestor, so skip it.',
      "2 is 3's parent: 3-2 is the tree edge dfs came along, so skip it.",
      '3 is already finished (a descendant of 1): skip it.',
      '2 is already finished (a descendant of 0): skip it.',
      '3 is already finished (a descendant of 0): skip it.',
    ]);
    // 3 meets 0 and then 1 with the same stack: the stack is asked once, not twice in a row
    const reads = r.steps.filter((s) => s.line === 7);
    expect(reads.map((s) => s.ask?.kind ?? null)).toEqual(['choice', 'order', 'choice', 'order', null, null, null, null, null]);
    expect(dfs.result(lastState(r), preset('complete-4'))).toEqual({ d: [1, 2, 3, 4], f: [8, 7, 6, 5] });
  });

  it('disconnected: the outer loop starts new trees; the pick at an empty stack is the next start', () => {
    const input = preset('disconnected');
    const r = runModule(dfs, input);
    const roots = r.steps.filter((s) => s.line === 3 && s.events.some((e) => e.t === 'call'));
    expect(roots.map((s) => s.note)).toEqual([
      '0 is not visited: the outer loop starts the first tree with dfs(0).',
      '3 is not visited: the outer loop starts a new tree with dfs(3).',
      '5 is not visited: the outer loop starts a new tree with dfs(5).',
    ]);
    const ask = must(roots[1]).ask;
    expect(ask).toMatchObject({ kind: 'pick', prompt: 'The call stack is empty. Which node does dfs visit next?', answer: 'n:3' });
    if (ask?.kind === 'pick') {
      expect(ask.candidates).toEqual(['n:0', 'n:1', 'n:2', 'n:3', 'n:4', 'n:5']);
      expect(ask.distractors.map((d) => [d.answer, d.kind])).toEqual([['n:5', 'order']]);
    }
    expect(must(roots[2]).ask).toBeUndefined(); // 5 is the only unvisited node left: nothing to choose
    const skips = r.steps.filter((s) => s.phase === 'outer');
    expect(skips.map((s) => s.note)).toEqual(['1, 2 are already visited: the outer loop skips them.', '4 is already visited: the outer loop skips it.']);
    expect(must(r.steps.at(-1)).note).toBe('Every node is finished: 3 DFS trees, and the clock ends at 12.');
    expect(r.steps.length).toBe(expectedSteps(input));
    // an isolated node: call, discover, finish (a leaf: "return now?" → yes)
    const fin5 = must(r.steps.at(-2));
    expect(fin5.ask).toMatchObject({ kind: 'choice', answer: 'yes' });
    expect(fin5.events).not.toContainEqual(expect.objectContaining({ t: 'mark', as: 'active' }));
  });

  it('pick asks: the answer becomes the active node; candidates are every node but the running one', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = runModule(dfs, input);
        r.steps.forEach((s, k) => {
          if (s.ask?.kind !== 'pick') return;
          const before = must(r.states[k]);
          const after = must(r.states[k + 1]);
          expect(after.graph?.nodes.find((x) => x.mark === 'active')?.id).toBe(s.ask.answer);
          const top = before.frameOrder.at(-1);
          const running = top === undefined ? null : `n:${String(before.frames[top]?.args['u'])}`;
          expect(s.ask.candidates).toEqual(Array.from({ length: input.n }, (_, v) => `n:${v}`).filter((id) => id !== running));
          // the answer is the smallest unvisited neighbour of the running node (or the smallest unvisited node)
          const unvisited = before.graph?.nodes.filter((x) => x.mark === null && x.text === null).map((x) => Number(x.label)) ?? [];
          if (running === null) expect(s.ask.answer).toBe(`n:${Math.min(...unvisited)}`);
        });
      }),
      { numRuns: 300 },
    );
  });

  it('choice asks: "no" only while an unvisited neighbour waits; "yes" only on finish steps', () => {
    fc.assert(
      fc.property(arb, (input) => {
        const r = runModule(dfs, input);
        for (const s of r.steps) {
          if (s.ask?.kind !== 'choice') continue;
          if (s.ask.answer === 'yes') expect(s.line).toBe(9);
          else expect(s.line).toBe(7);
          expect(s.ask.distractors[0]?.kind).toBe('base-case');
        }
      }),
      { numRuns: 300 },
    );
  });

  it('every step and ask obeys the narration and ask rules on presets and random inputs', () => {
    const inputs = [...dfs.presets.map((p) => p.input)];
    for (let i = 0; i < 50; i++) inputs.push(dfs.randomInput(createRng(`n-${i}`)));
    inputs.push({ n: 10, edges: [] });
    inputs.push({ n: 10, edges: Array.from({ length: 9 }, (_, k) => ({ a: k, b: k + 1 })) });
    for (const input of inputs) {
      const r = runModule(dfs, input);
      for (const s of r.steps) {
        expect(s.note.length).toBeLessThanOrEqual(90);
        expect(s.note).not.toMatch(/\bwe\b/i);
        if (s.ask) {
          expect(s.ask.rule.length).toBeGreaterThan(0);
          expect(s.ask.prompt).not.toMatch(/\bwe\b/i);
          for (const d of s.ask.distractors) expect(d.rule.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('guided asks exist on a typical preset', () => {
    const r = runModule(dfs, preset('tree'));
    expect(askIndices(r.steps, 'guided').length).toBe(13); // 7 discoveries + 6 picks
    expect(askIndices(r.steps, 'full').length).toBeGreaterThan(13);
  });

  it('step count is exact, and stays under the cap: the measured worst case is 62 steps', () => {
    const cases: DfsInput[] = [];
    // K7 (16 of its 21 edges) plus three isolated nodes: the most trees with 16 edges
    for (let i = 0; i < 300; i++) {
      const rng = createRng(`cap-${i}`);
      const k = rng.int(6, 10);
      const pairs: [number, number][] = [];
      for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) pairs.push([a, b]);
      const perm = rng.shuffle(Array.from({ length: 10 }, (_, v) => v));
      const edges = rng
        .shuffle(pairs)
        .slice(0, 16)
        .map(([a, b]) => ({ a: perm[a] as number, b: perm[b] as number }));
      cases.push({ n: 10, edges });
    }
    for (let i = 0; i < 200; i++) cases.push(dfs.randomInput(createRng(`cap-r-${i}`)));
    let max = 0;
    for (const input of cases) {
      const r = runModule(dfs, input);
      expect(r.truncated).toBe(false);
      expect(r.steps.length).toBe(expectedSteps(input));
      max = Math.max(max, r.steps.length);
    }
    // Bound: 2 + 3n + (2m − n + trees) + skip runs ≤ 2 + 2n + 2m + 2·trees; n = 10, m = 16,
    // at most 4 trees (16 edges need 7 nodes) → 62. Skip runs ≤ trees.
    expect(max).toBeLessThanOrEqual(62);
    expect(dfs.meta.caps.maxSteps).toBeGreaterThanOrEqual(Math.ceil(62 * 1.1));
    const stepsOf = (s: Step[]) => s.length;
    expect(stepsOf(runModule(dfs, { n: 10, edges: [] }).steps)).toBe(1 + 30 + 1); // no skips: every node is a root
  });

  it('the scene builds for every state of every preset', () => {
    for (const p of dfs.presets) {
      const r = runModule(dfs, p.input);
      const layout = computeLayout(r);
      for (const s of r.states) buildScene(s, layout, { width: layout.width });
    }
  });

  it('random inputs are valid, reproducible and hit their targets', () => {
    for (const target of [undefined, 'forest', 'connected', 'deep', 'back-edge']) {
      const a = dfs.randomInput(createRng('seed-1'), target);
      const b = dfs.randomInput(createRng('seed-1'), target);
      expect(a).toEqual(b);
      expect(dfs.validate(dfs.encode(a)).ok).toBe(true);
      if (target === 'forest') expect(treeCount(a)).toBeGreaterThanOrEqual(2);
      if (target === 'connected') expect(treeCount(a)).toBe(1);
      if (target === 'deep') expect(maxDepth(a)).toBeGreaterThanOrEqual(5);
      if (target === 'back-edge') expect(hasBackEdge(a)).toBe(true);
      checkAll(dfs, a);
    }
    expect(dfs.randomInput(createRng('seed-1'))).not.toEqual(dfs.randomInput(createRng('seed-2')));
  });

  it('review targets exercise their mistake kinds (order → back-edge, boundary → deep, base-case → forest)', () => {
    const kinds = (input: DfsInput): Set<string> => new Set(runModule(dfs, input).steps.flatMap((st) => (st.ask ? st.ask.distractors.map((d) => d.kind) : [])));
    const askKinds = (input: DfsInput): Set<string> => new Set(runModule(dfs, input).steps.flatMap((st) => (st.ask ? [st.ask.kind] : [])));
    for (let i = 0; i < 30; i++) {
      const back = dfs.randomInput(createRng(`t-${i}`), 'back-edge');
      expect(askKinds(back).has('order')).toBe(true); // the call-stack ask only comes with a back edge
      expect(kinds(back).has('order')).toBe(true);
      expect(kinds(dfs.randomInput(createRng(`t-${i}`), 'deep')).has('boundary')).toBe(true);
      expect(kinds(dfs.randomInput(createRng(`t-${i}`), 'forest')).has('base-case')).toBe(true);
    }
  });

  it('rejects weights, self-loops, duplicates and out-of-range nodes with actionable sentences', () => {
    expect(dfs.validate({ g: '0-1:3', n: '2' })).toEqual({ ok: false, error: 'DFS edges have no weights: write 0-1, not 0-1:3.' });
    expect(dfs.validate({ g: '1-1', n: '2' })).toMatchObject({ ok: false, error: expect.stringContaining('self-loop') });
    expect(dfs.validate({ g: '0-1,1-0', n: '2' })).toEqual({ ok: false, error: 'Edge 1-0 is listed twice: keep one copy.' });
    expect(dfs.validate({ g: '0-5', n: '3' })).toEqual({ ok: false, error: 'Edge 0-5 uses a node outside 0–2.' });
    expect(dfs.validate({ g: '', n: '11' })).toEqual({ ok: false, error: 'n must be between 1 and 10 (got 11).' });
    expect(dfs.validate({ g: '', n: 'x' })).toEqual({ ok: false, error: 'Enter the number of nodes n as a whole number from 1 to 10.' });
    expect(dfs.validate({ g: '0;1', n: '2' })).toMatchObject({ ok: false, error: expect.stringContaining('a-b') });
    const many = [...Array.from({ length: 9 }, (_, k) => `0-${k + 1}`), ...Array.from({ length: 8 }, (_, k) => `1-${k + 2}`)].join(',');
    expect(dfs.validate({ g: many, n: '10' })).toEqual({ ok: false, error: 'Use at most 16 edges (got 17).' });
    expect(dfs.validate({ g: '', n: '1' })).toEqual({ ok: true, input: { n: 1, edges: [] } });
    expect(dfs.validate({ g: '0-1,0-2', n: '5' })).toEqual({ ok: true, input: { n: 5, edges: [{ a: 0, b: 1 }, { a: 0, b: 2 }] } });
    expect(dfs.encode({ n: 5, edges: [{ a: 0, b: 1 }, { a: 0, b: 2 }] })).toEqual({ g: '0-1,0-2', n: '5' });
  });
});
