/** Algorithm registry: static metadata for the library page plus lazy loaders.
 *  Lead-owned file: packages add one line each when their module is done. */

import type { AlgorithmModule, Family } from './types';

export interface RegistryEntry {
  id: string;
  title: string;
  family: Family;
  /** What the learner practises, one line. */
  practice: string;
  minutes: number;
  load: () => Promise<AlgorithmModule<unknown>>;
}

// Modules are typed on their own input; the registry erases it. Screens
// only ever pass values that came out of the same module (decode/random/preset).
const erase = <I>(m: AlgorithmModule<I>): AlgorithmModule<unknown> => m as unknown as AlgorithmModule<unknown>;

export const registry: RegistryEntry[] = [
  {
    id: 'binary-search',
    title: 'Binary search',
    family: 'search',
    practice: 'Where lo, mid and hi go, and when the loop ends.',
    minutes: 3,
    load: () => import('./binary-search').then((m) => erase(m.binarySearch)),
  },
  {
    id: 'quick-sort',
    title: 'Quick sort (Lomuto)',
    family: 'sort',
    practice: 'Where i and j go, which side each element lands on, and where the pivot settles.',
    minutes: 6,
    load: () => import('./quick-sort').then((m) => erase(m.quickSort)),
  },
  {
    id: 'dijkstra',
    title: 'Dijkstra (lazy deletion)',
    family: 'graph',
    practice: 'Which entry pops next, whether it is stale, and what the relaxed distance becomes.',
    minutes: 5,
    load: () => import('./dijkstra').then((m) => erase(m.dijkstra)),
  },
  {
    id: 'bst',
    title: 'BST insert, search, delete',
    family: 'tree',
    practice: 'Which child comes next, which delete case applies, and who the successor is.',
    minutes: 4,
    load: () => import('./bst').then((m) => erase(m.bst)),
  },
  {
    id: 'insertion-sort',
    title: 'Insertion sort',
    family: 'sort',
    practice: 'Which element shifts into the gap, whether a[j] moves, and where the key lands.',
    minutes: 4,
    load: () => import('./insertion-sort').then((m) => erase(m.insertionSort)),
  },
  {
    id: 'merge-sort',
    title: 'Merge sort (top-down)',
    family: 'sort',
    practice: 'Which front is copied next, what is left over, and which call returns.',
    minutes: 6,
    load: () => import('./merge-sort').then((m) => erase(m.mergeSort)),
  },
  {
    id: 'bfs',
    title: 'Breadth-first search',
    family: 'graph',
    practice: 'Which node leaves the queue, what the queue holds after each discovery, and each dist.',
    minutes: 4,
    load: () => import('./bfs').then((m) => erase(m.bfs)),
  },
  {
    id: 'knapsack',
    title: '0/1 knapsack',
    family: 'dp',
    practice: 'The value of each cell, which cell it reads besides the one above, and which items are taken.',
    minutes: 6,
    load: () => import('./knapsack').then((m) => erase(m.knapsack)),
  },
];

export function findEntry(id: string): RegistryEntry | undefined {
  return registry.find((e) => e.id === id);
}
