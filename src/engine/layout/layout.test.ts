import { describe, expect, it } from 'vitest';
import { binarySearch } from '@/algorithms/binary-search';
import { fixtures } from '@/render/fixtures';
import type { Step } from '../events';
import { run } from '../run';
import { emptyState, withArray } from '../state';
import { computeLayout } from './index';
import { layoutArrays, slotCenter } from './array';
import { PAD } from './constants';
import { layoutGraph } from './graph';
import { layoutGrid } from './grid';
import { layoutTree, pathOf, treePos } from './tree';


/** Narrows away undefined/null in tests without non-null assertions. */
function must<T>(v: T | null | undefined, what = 'value'): T {
  if (v === null || v === undefined) throw new Error(`expected ${what}`);
  return v;
}

const W = 900;

describe('array layout', () => {
  it('cellW = min(56, (width − 2·pad) / n) and slots are contiguous', () => {
    const input = must(binarySearch.presets[0]).input;
    const r = run(binarySearch.initialState(input), binarySearch.generate(input));
    const al = must(layoutArrays(r, W, 0)).layout;
    const row = must(al.rows['a']);
    expect(row.cellW).toBe(56);
    expect(row.n).toBe(input.a.length);
    expect(slotCenter(row, 3) - slotCenter(row, 2)).toBeCloseTo(row.cellW);
    const wide = withArray(emptyState(), 'a', Array.from({ length: 16 }, (_, i) => i));
    const rw = run(wide, []);
    expect(must(must(layoutArrays(rw, 400, 0)).layout.rows['a']).cellW).toBeCloseTo((400 - 2 * PAD) / 16);
  });

  it("'hold' renders above 'a'; other arrays stack below in declaration order", () => {
    const initial = withArray(emptyState(), 'a', [3, 1, 2]);
    const steps: Step[] = [
      { line: 1, events: [{ t: 'array', name: 'aux', size: 3 }], note: 'aux' },
      { line: 1, events: [{ t: 'array', name: 'hold', size: 1 }], note: 'hold' },
      { line: 1, events: [{ t: 'array', name: 'heap', size: 2 }], note: 'heap' },
    ];
    const r = run(initial, steps);
    const al = must(layoutArrays(r, W, 0)).layout;
    expect(al.order).toEqual(['hold', 'a', 'aux', 'heap']);
    expect(must(al.rows['hold']).y).toBeLessThan(must(al.rows['a']).y);
    expect(must(al.rows['a']).y).toBeLessThan(must(al.rows['aux']).y);
    expect(must(al.rows['aux']).y).toBeLessThan(must(al.rows['heap']).y);
    // the same geometry at every step: layout is per run, not per state
    expect(computeLayout(r, { width: W })).toEqual(computeLayout(run(initial, steps), { width: W }));
  });
});

describe('tree layout', () => {
  it('positions are path-based: x = cx + Σ ±span/2^d, y = y0 + d·rowH', () => {
    const r = run(must(fixtures['tree']).initial, must(fixtures['tree']).steps);
    const tl = must(layoutTree(r, W, 0)).layout;
    expect(treePos(tl, [])).toEqual({ x: tl.cx, y: tl.y0 });
    expect(treePos(tl, ['L'])).toEqual({ x: tl.cx - tl.span / 2, y: tl.y0 + tl.rowH });
    expect(treePos(tl, ['R', 'L'])).toEqual({ x: tl.cx + tl.span / 2 - tl.span / 4, y: tl.y0 + 2 * tl.rowH });
    expect(tl.depth).toBe(3);
    // the extreme leaves of the deepest path land inside the margins
    const leftmost = treePos(tl, ['L', 'L', 'L']);
    const rightmost = treePos(tl, ['R', 'R', 'R']);
    expect(leftmost.x).toBeCloseTo(PAD + tl.r);
    expect(rightmost.x).toBeCloseTo(W - PAD - tl.r);
  });

  it('pathOf walks the parent chain', () => {
    const r = run(must(fixtures['tree']).initial, must(fixtures['tree']).steps);
    const mid = must(r.states[10]);
    expect(pathOf(mid, 'n:8')).toEqual([]);
    expect(pathOf(mid, 'n:4')).toEqual(['L', 'R', 'L']);
    expect(pathOf(mid, 'n:13')).toEqual(['R', 'R', 'L']);
  });
});

describe('graph layout', () => {
  it('layers by BFS depth from the smallest id, one node per column slot', () => {
    const r = run(must(fixtures['graph']).initial, must(fixtures['graph']).steps);
    const gl = must(layoutGraph(r, W, 0)).layout;
    const x = (id: string) => must(gl.pos[id]).x;
    expect(x('n:0')).toBeLessThan(x('n:1'));
    expect(x('n:1')).toBe(x('n:2'));
    expect(x('n:2')).toBeLessThan(x('n:3'));
    expect(x('n:3')).toBeLessThan(x('n:4'));
    expect(must(gl.pos['n:1']).y).not.toBe(must(gl.pos['n:2']).y);
    for (const p of Object.values(gl.pos)) {
      expect(p.x).toBeGreaterThanOrEqual(PAD);
      expect(p.x).toBeLessThanOrEqual(W - PAD);
    }
  });

  it('places unreachable nodes in a trailing column', () => {
    const steps: Step[] = [
      {
        line: 1,
        events: [{ t: 'graph', nodes: [{ id: 'n:0', label: '0' }, { id: 'n:1', label: '1' }, { id: 'n:2', label: '2' }], edges: [{ id: 'g:0-1', a: 'n:0', b: 'n:1' }] }],
        note: 'g',
      },
    ];
    const gl = must(layoutGraph(run(emptyState(), steps), W, 0)).layout;
    expect(must(gl.pos['n:2']).x).toBeGreaterThan(must(gl.pos['n:1']).x);
  });
});

describe('grid layout', () => {
  it('cellW = min(44, available / (cols + 1)) with a label row and column', () => {
    const r = run(must(fixtures['grid']).initial, must(fixtures['grid']).steps);
    const gl = must(layoutGrid(r, W, 0)).layout;
    expect(gl.cellW).toBe(44);
    expect(gl.x0).toBe(PAD + 44);
    expect(gl.y0).toBe(PAD + 44);
    const narrow = must(layoutGrid(r, 200, 0)).layout;
    expect(narrow.cellW).toBeCloseTo((200 - 2 * PAD) / 5);
  });
});

describe('computeLayout', () => {
  it('stacks sections and returns null for absent ones', () => {
    const rec = computeLayout(run(must(fixtures['recursion']).initial, must(fixtures['recursion']).steps), { width: W });
    expect(rec.array).not.toBeNull();
    expect(rec.recursion).not.toBeNull();
    expect(rec.tree).toBeNull();
    expect(rec.graph).toBeNull();
    expect(rec.grid).toBeNull();
    const firstFrameY = Math.min(...Object.values(must(rec.recursion).pos).map((p) => p.y));
    expect(firstFrameY).toBeGreaterThan(must(must(rec.array).rows['a']).caretY);
    expect(rec.height).toBeGreaterThan(firstFrameY);
  });
});
