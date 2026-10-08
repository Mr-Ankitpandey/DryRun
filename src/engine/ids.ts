/** ID minting conventions (docs/ARCHITECTURE.md §1). Only these helpers build ids. */

import type { Id } from './events';

export const ids = {
  /** Element created at input index i of the main array. */
  el: (i: number): Id => `e:${i}`,
  /** Element minted by a `set` into an empty slot of array `arr`. */
  elIn: (arr: string, i: number, n: number): Id => `e:${arr}:${i}#${n}`,
  node: (key: number | string): Id => `n:${key}`,
  edge: (a: number | string, b: number | string): Id => {
    const [x, y] = String(a) < String(b) ? [a, b] : [b, a];
    return `g:${x}-${y}`;
  },
  /** Directed arc a → b (a graph with `directed: true`); `edge` stays undirected. */
  arc: (a: number | string, b: number | string): Id => `a:${a}>${b}`,
  /** The implicit-tree node that mirrors an array element (heap array ↔ tree). */
  mirror: (elementId: Id): Id => `h:${elementId}`,
  cell: (r: number, c: number): Id => `c:${r},${c}`,
  frame: (n: number): Id => `f:${n}`,
  item: (n: number): Id => `q:${n}`,
};

export const cellKey = (r: number, c: number): string => `${r},${c}`;
