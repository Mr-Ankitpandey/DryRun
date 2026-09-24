/** Algorithm module anatomy (docs/ARCHITECTURE.md §6). Adding an algorithm is
 *  one folder implementing this interface plus an entry in registry.ts. */

import type { PanelKind, Step } from '@/engine/events';
import type { State } from '@/engine/state';
import type { Rng } from '@/lib/rng';

export type Family = 'search' | 'sort' | 'tree' | 'graph' | 'dp';
export type RendererKind = 'array' | 'tree' | 'graph' | 'grid';

export interface AlgorithmMeta {
  id: string;
  title: string;
  family: Family;
  renderers: RendererKind[];
  panels: PanelKind[];
  /** Human sentence shown under the title. */
  tieBreak: string;
  /** Rough minutes for one guided trace (used by the review queue). */
  minutes: number;
  caps: { maxSteps: number; maxSize: number };
  /** Variants selectable in the UI, e.g. classic / lower-bound. */
  variants: { id: string; title: string }[];
}

export interface Preset<I> {
  id: string;
  title: string;
  input: I;
  why: string;
}

export type ValidationResult<I> = { ok: true; input: I } | { ok: false; error: string };

export interface AlgorithmModule<I> {
  meta: AlgorithmMeta;
  pseudocode: Record<string, string[]>; // by variant id; 1-based lines = index + 1
  invariant: Record<string, { name: string; sentence: string }>; // by variant id
  initialState(input: I): State;
  generate(input: I): Iterable<Step>;
  /** Plain implementation used only by tests. */
  reference(input: I): unknown;
  /** Reads the final state and returns the comparable result (tests). */
  result(finalState: State, input: I): unknown;
  /** Returns null when the invariant holds in this state. */
  invariantCheck(state: State, input: I): string | null;
  presets: Preset<I>[];
  /** Constrained random input; retries to hit `target` then falls back to a preset. */
  randomInput(rng: Rng, target?: string): I;
  /** Free-text input from the UI → validated input or an actionable error. */
  validate(raw: Record<string, string>): ValidationResult<I>;
  encode(input: I): Record<string, string>;
  decode(params: Record<string, string>): I | null;
  /** Variant id carried by an input (for pseudocode/invariant lookup). */
  variantOf(input: I): string;
}
