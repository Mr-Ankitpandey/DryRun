import { describe, expect, it } from 'vitest';
import { byRegistryOrder, titleOf } from './titles';

describe('titles', () => {
  it('uses registry titles and falls back to the id', () => {
    expect(titleOf('dijkstra')).toBe('Dijkstra (lazy deletion)');
    expect(titleOf('no-such')).toBe('no-such');
  });
  it('orders by registry position, unknown ids last', () => {
    expect(['zz', 'bst', 'dijkstra', 'binary-search', 'aa'].sort(byRegistryOrder)).toEqual(['binary-search', 'dijkstra', 'bst', 'aa', 'zz']);
  });
});
