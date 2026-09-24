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
];

export function findEntry(id: string): RegistryEntry | undefined {
  return registry.find((e) => e.id === id);
}
