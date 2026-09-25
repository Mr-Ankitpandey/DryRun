/** Registry lookups the learning screens share. */

import { findEntry, registry } from '@/algorithms/registry';

/** Display title for an algorithm id; the id itself when the registry does not know it. */
export const titleOf = (id: string): string => findEntry(id)?.title ?? id;

/** Estimated minutes per algorithm id, for the review time estimate. */
export const MINUTES_BY_ID: Readonly<Record<string, number>> = Object.fromEntries(registry.map((e) => [e.id, e.minutes]));

const ORDER = new Map(registry.map((e, i) => [e.id, i]));

/** Stable display order: registry order, unknown ids last by id. Panels keep their place between visits. */
export function byRegistryOrder(a: string, b: string): number {
  const ia = ORDER.get(a) ?? Number.MAX_SAFE_INTEGER;
  const ib = ORDER.get(b) ?? Number.MAX_SAFE_INTEGER;
  return ia - ib || a.localeCompare(b);
}
