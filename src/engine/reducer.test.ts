import { describe, expect, it } from 'vitest';
import type { Step, VizEvent } from './events';
import { ids } from './ids';
import { apply, applyEvent } from './reducer';
import type { State } from './state';
import { arrayValues, emptyState, withArray } from './state';

const base = () => withArray(emptyState(), 'a', [5, 3, 8]);
const step = (events: VizEvent[]): Step => ({ line: 1, events, note: 'test' });
const ev = (s: State, e: VizEvent) => applyEvent(s, e);

describe('reducer: arrays and identity', () => {
  it('swap exchanges slots but keeps element identity', () => {
    const s = ev(base(), { t: 'swap', a: { arr: 'a', i: 0 }, b: { arr: 'a', i: 2 } });
    expect(arrayValues(s, 'a')).toEqual([8, 3, 5]);
    expect(s.arrays.a?.slots).toEqual(['e:2', 'e:1', 'e:0']);
  });

  it('move shifts an element into an empty slot and frees its old slot', () => {
    let s = ev(base(), { t: 'array', name: 'a', size: 4 });
    s = ev(s, { t: 'move', id: 'e:2', to: { arr: 'a', i: 3 } });
    expect(s.arrays.a?.slots).toEqual(['e:0', 'e:1', null, 'e:2']);
    expect(() => ev(s, { t: 'move', id: 'e:0', to: { arr: 'a', i: 1 } })).toThrow(/occupied/);
    expect(() => ev(s, { t: 'move', id: 'nope', to: { arr: 'a', i: 2 } })).toThrow(/unknown element/);
  });

  it('set writes a value in place or mints a stable id into an empty slot', () => {
    let s = ev(base(), { t: 'set', slot: { arr: 'a', i: 1 }, value: 42 });
    expect(arrayValues(s, 'a')).toEqual([5, 42, 8]);
    expect(s.arrays.a?.slots[1]).toBe('e:1');
    s = ev(s, { t: 'array', name: 'aux', size: 2 });
    s = ev(s, { t: 'set', slot: { arr: 'aux', i: 0 }, value: 7 });
    expect(s.arrays.aux?.slots[0]).toBe(ids.elIn('aux', 0, 1));
    expect(arrayValues(s, 'aux')).toEqual([7, null]);
    s = ev(s, { t: 'clear', slot: { arr: 'aux', i: 0 } });
    expect(arrayValues(s, 'aux')).toEqual([null, null]);
    expect(Object.keys(s.elements)).toHaveLength(3);
  });

  it('refuses to shrink an array over an element', () => {
    expect(() => ev(base(), { t: 'array', name: 'a', size: 2 })).toThrow(/shrinking/);
  });

  it('pointers accept -1..size and reject beyond', () => {
    let s = ev(base(), { t: 'pointer', name: 'hi', at: { arr: 'a', i: 3 } });
    s = ev(s, { t: 'pointer', name: 'lo', at: { arr: 'a', i: -1 } });
    expect(s.pointers.hi).toEqual({ arr: 'a', i: 3 });
    expect(() => ev(s, { t: 'pointer', name: 'p', at: { arr: 'a', i: 4 } })).toThrow(/outside/);
    expect(() => ev(s, { t: 'pointer', name: 'p', at: { arr: 'zz', i: 0 } })).toThrow(/no array/);
  });

  it('regions validate their range', () => {
    const s = ev(base(), { t: 'region', name: 'r', kind: 'sorted', arr: 'a', range: [0, 1] });
    expect(s.regions.r?.range).toEqual([0, 1]);
    expect(() => ev(s, { t: 'region', name: 'r', kind: 'sorted', arr: 'a', range: [0, 3] })).toThrow(/bad range/);
  });

  it('mark resolves refs by id, slot or cell', () => {
    let s = ev(base(), { t: 'mark', ref: { arr: 'a', i: 1 }, as: 'key' });
    expect(s.elements['e:1']?.mark).toBe('key');
    s = ev(s, { t: 'mark', ref: { id: 'e:1' }, as: null });
    expect(s.elements['e:1']?.mark).toBeNull();
    expect(() => ev(s, { t: 'mark', ref: { id: 'ghost' }, as: 'done' })).toThrow(/unknown target/);
  });
});

describe('reducer: transient, vars, structural sharing', () => {
  it('clears transient marks at the start of the next step', () => {
    let s = apply(base(), step([{ t: 'compare', a: { arr: 'a', i: 0 }, b: { arr: 'a', i: 1 }, result: '>' }, { t: 'read', ref: { id: 'e:2' } }]));
    expect(s.transient.compares).toHaveLength(1);
    expect(s.transient.reads).toHaveLength(1);
    s = apply(s, step([{ t: 'var', name: 'i', value: 1 }]));
    expect(s.transient.compares).toHaveLength(0);
    expect(s.vars.i).toBe(1);
  });

  it('shares untouched sub-objects between states', () => {
    const s0 = base();
    const s1 = apply(s0, step([{ t: 'var', name: 'i', value: 1 }]));
    expect(s1.arrays).toBe(s0.arrays);
    expect(s1.elements).toBe(s0.elements);
    expect(s1.vars).not.toBe(s0.vars);
    expect(s0.vars.i).toBeUndefined();
  });
});

describe('reducer: panels', () => {
  it('queue pops from the front only, stack from the top only', () => {
    let s = ev(emptyState(), { t: 'panel', panel: 'q', kind: 'queue' });
    s = ev(s, { t: 'push', panel: 'q', item: { id: 'q:1', label: 'A' } });
    s = ev(s, { t: 'push', panel: 'q', item: { id: 'q:2', label: 'B' } });
    expect(() => ev(s, { t: 'pop', panel: 'q', itemId: 'q:2' })).toThrow(/front/);
    s = ev(s, { t: 'pop', panel: 'q', itemId: 'q:1' });
    expect(s.panels.q?.items.map((i) => i.id)).toEqual(['q:2']);

    let st = ev(emptyState(), { t: 'panel', panel: 's', kind: 'stack' });
    st = ev(st, { t: 'push', panel: 's', item: { id: 'q:1', label: 'A' } });
    st = ev(st, { t: 'push', panel: 's', item: { id: 'q:2', label: 'B' } });
    expect(() => ev(st, { t: 'pop', panel: 's', itemId: 'q:1' })).toThrow(/top/);
  });

  it('pq keeps items ordered by (key, id) and pops only the minimum', () => {
    let s = ev(emptyState(), { t: 'panel', panel: 'pq', kind: 'pq' });
    s = ev(s, { t: 'push', panel: 'pq', item: { id: 'q:1', label: '(5,a)', key: 5 } });
    s = ev(s, { t: 'push', panel: 'pq', item: { id: 'q:2', label: '(2,b)', key: 2 } });
    s = ev(s, { t: 'push', panel: 'pq', item: { id: 'q:0', label: '(2,c)', key: 2 } });
    expect(s.panels.pq?.items.map((i) => i.id)).toEqual(['q:0', 'q:2', 'q:1']);
    expect(() => ev(s, { t: 'pop', panel: 'pq', itemId: 'q:1' })).toThrow(/minimum/);
    expect(() => ev(s, { t: 'push', panel: 'pq', item: { id: 'q:1', label: 'dup', key: 1 } })).toThrow(/duplicate/);
  });

  it('pq breaks equal keys by tie, then numerically by id', () => {
    let s = ev(emptyState(), { t: 'panel', panel: 'pq', kind: 'pq' });
    s = ev(s, { t: 'push', panel: 'pq', item: { id: 'q:2', label: '(3, node 7)', key: 3, tie: 7 } });
    s = ev(s, { t: 'push', panel: 'pq', item: { id: 'q:10', label: '(3, node 2)', key: 3, tie: 2 } });
    s = ev(s, { t: 'push', panel: 'pq', item: { id: 'q:9', label: '(3, node 2 again)', key: 3, tie: 2 } });
    expect(s.panels.pq?.items.map((i) => i.id)).toEqual(['q:9', 'q:10', 'q:2']);
  });
});

describe('reducer: trees', () => {
  const tree = () => {
    let s = ev(emptyState(), { t: 'node.add', id: 'n:8', key: 8, parent: null, side: null });
    s = ev(s, { t: 'node.add', id: 'n:3', key: 3, parent: 'n:8', side: 'L' });
    s = ev(s, { t: 'node.add', id: 'n:10', key: 10, parent: 'n:8', side: 'R' });
    s = ev(s, { t: 'node.add', id: 'n:6', key: 6, parent: 'n:3', side: 'R' });
    return s;
  };

  it('builds, and rejects occupied sides and second roots', () => {
    const s = tree();
    expect(s.root).toBe('n:8');
    expect(s.tree['n:3']).toMatchObject({ parent: 'n:8', right: 'n:6' });
    expect(() => ev(s, { t: 'node.add', id: 'n:4', key: 4, parent: 'n:3', side: 'R' })).toThrow(/occupied/);
    expect(() => ev(s, { t: 'node.add', id: 'n:1', key: 1, parent: null, side: null })).toThrow(/root already/);
  });

  it('one-child delete: detach, relink child to grandparent, remove', () => {
    let s = tree();
    s = ev(s, { t: 'node.detach', id: 'n:3' });
    expect(s.tree['n:8']?.left).toBeNull();
    expect(s.tree['n:3']?.parent).toBeNull();
    s = ev(s, { t: 'node.relink', id: 'n:6', parent: 'n:8', side: 'L' });
    expect(s.tree['n:8']?.left).toBe('n:6');
    expect(s.tree['n:3']?.right).toBeNull();
    s = ev(s, { t: 'node.remove', id: 'n:3' });
    expect(s.tree['n:3']).toBeUndefined();
    expect(Object.keys(s.tree).sort()).toEqual(['n:10', 'n:6', 'n:8']);
  });

  it('refuses to remove a node that still has children', () => {
    expect(() => ev(tree(), { t: 'node.remove', id: 'n:3' })).toThrow(/children/);
  });

  it('root replacement: detach root, relink child as root', () => {
    let s = ev(emptyState(), { t: 'node.add', id: 'n:1', key: 1, parent: null, side: null });
    s = ev(s, { t: 'node.add', id: 'n:2', key: 2, parent: 'n:1', side: 'R' });
    s = ev(s, { t: 'node.detach', id: 'n:1' });
    expect(s.root).toBeNull();
    s = ev(s, { t: 'node.relink', id: 'n:2', parent: null, side: null });
    expect(s.root).toBe('n:2');
    s = ev(s, { t: 'node.remove', id: 'n:1' });
    expect(Object.keys(s.tree)).toEqual(['n:2']);
  });
});

describe('reducer: graph, grid, frames', () => {
  it('graph marks nodes and edges, labels nodes', () => {
    let s = ev(emptyState(), {
      t: 'graph',
      nodes: [
        { id: 'n:0', label: '0' },
        { id: 'n:1', label: '1' },
      ],
      edges: [{ id: ids.edge(0, 1), a: 'n:0', b: 'n:1', w: 4 }],
    });
    s = ev(s, { t: 'mark', ref: { id: 'n:1' }, as: 'frontier' });
    s = ev(s, { t: 'edge.mark', id: 'g:0-1', as: 'relaxed' });
    s = ev(s, { t: 'label', id: 'n:1', text: '4' });
    expect(s.graph?.nodes[1]).toMatchObject({ mark: 'frontier', text: '4' });
    expect(s.graph?.edges[0]?.mark).toBe('relaxed');
    expect(() => ev(s, { t: 'edge.mark', id: 'g:9-9', as: null })).toThrow(/unknown edge/);
  });

  it('grid cells require computed dependencies', () => {
    let s = ev(emptyState(), { t: 'grid', rows: 2, cols: 2, rowLabels: ['0', '1'], colLabels: ['0', '1'] });
    s = ev(s, { t: 'cell', r: 0, c: 0, value: 0, deps: [] });
    expect(() => ev(s, { t: 'cell', r: 1, c: 1, value: 3, deps: [[0, 1]] })).toThrow(/not computed/);
    s = ev(s, { t: 'cell', r: 0, c: 1, value: 0, deps: [] });
    s = ev(s, { t: 'cell', r: 1, c: 1, value: 3, deps: [[0, 1]] });
    s = ev(s, { t: 'mark', ref: { cell: [1, 1] }, as: 'done' });
    expect(s.grid?.cells['1,1']).toMatchObject({ value: 3, mark: 'done' });
  });

  it('frames push and return in LIFO order', () => {
    let s = ev(emptyState(), { t: 'call', id: 'f:1', label: 'qs(0,4)', args: { lo: 0, hi: 4 }, parent: null });
    s = ev(s, { t: 'call', id: 'f:2', label: 'qs(0,1)', args: { lo: 0, hi: 1 }, parent: 'f:1' });
    expect(() => ev(s, { t: 'return', id: 'f:1' })).toThrow(/not the top/);
    s = ev(s, { t: 'return', id: 'f:2', value: 1 });
    expect(s.frameOrder).toEqual(['f:1']);
    expect(s.frames['f:2']).toMatchObject({ returned: true, value: 1 });
  });
});
