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
];

export function findEntry(id: string): RegistryEntry | undefined {
  return registry.find((e) => e.id === id);
}
