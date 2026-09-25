import { describe, expect, it } from 'vitest';
import type { MistakeOccurrence } from '@/trace/mistakes';
import { algorithmsOf, traceRows } from './mistakes-view';

const occ = (id: string, algorithm: string, seed: string, at: number, input = 'i=1,2'): MistakeOccurrence => ({
  id,
  algorithm,
  seed,
  input,
  askIndex: 3,
  at,
  rule: 'r',
});

describe('traceRows', () => {
  it('collapses mistakes from the same trace and sorts newest first', () => {
    const rows = traceRows([
      occ('a', 'dijkstra', 's1', 100),
      occ('b', 'dijkstra', 's1', 300),
      occ('c', 'bst', 's2', 200),
      occ('d', 'dijkstra', 's1', 150, 'i=9'),
    ]);
    expect(rows.map((r) => [r.algorithm, r.seed, r.input, r.count, r.lastAt])).toEqual([
      ['dijkstra', 's1', 'i=1,2', 2, 300],
      ['bst', 's2', 'i=1,2', 1, 200],
      ['dijkstra', 's1', 'i=9', 1, 150],
    ]);
  });
  it('is empty for no occurrences', () => {
    expect(traceRows([])).toEqual([]);
  });
});

describe('algorithmsOf', () => {
  it('orders algorithms by how many mistakes they carry, then id', () => {
    expect(algorithmsOf([occ('a', 'bst', 'x', 1), occ('b', 'dijkstra', 'y', 2), occ('c', 'dijkstra', 'z', 3), occ('d', 'avl', 'w', 4)])).toEqual([
      'dijkstra',
      'avl',
      'bst',
    ]);
  });
});
