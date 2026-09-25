/** Trace URLs (the URL is a trace's identity: algorithm, input, seed, mode, level). */

import type { AlgorithmModule } from '@/algorithms/types';
import type { Level } from '@/trace/asks';
import { encodeInput } from '@/trace/session';
import { createRng, hashString, newSeed } from '@/lib/rng';
import { traceUrl } from '@/lib/url';

/** A new input for the same algorithm (and variant, when the module has several), with a new seed. */
export function freshTraceUrl(module: AlgorithmModule<unknown>, input: unknown, mode: 'trace' | 'watch', level: Level): string {
  const seed = newSeed();
  const target = module.meta.variants.length > 1 ? module.variantOf(input) : undefined;
  const next = module.randomInput(createRng(seed), target);
  return traceUrl(module.meta.id, { ...module.encode(next), seed, mode, level });
}

/** Seed for a link that carries none: derived from the input, so the same input
 *  always gives the same session identity (ARCHITECTURE §10). */
export function derivedSeed(algorithm: string, module: AlgorithmModule<unknown>, input: unknown): string {
  return hashString(`${algorithm}|${encodeInput(module.encode(input))}`).toString(36).slice(0, 6);
}
