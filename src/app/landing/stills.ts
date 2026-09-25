/** The three stills under the hero (predict, reveal, re-trace later). They are
 *  real states from the binary-search module, not drawings: the scene at the
 *  first ask, the state right after the hero's second ask with a real
 *  distractor as the ghost, and a fresh seeded input at its first ask. Pure. */

import { binarySearch } from '@/algorithms/binary-search';
import type { BinarySearchInput } from '@/algorithms/binary-search';
import type { Id } from '@/engine/events';
import type { Layout } from '@/engine/layout';
import { computeLayout } from '@/engine/layout';
import { ARRAY_MAX_CELL } from '@/engine/layout/array';
import { PAD } from '@/engine/layout/constants';
import { askIndices, run } from '@/engine/run';
import type { Scene } from '@/engine/scene';
import { buildScene } from '@/engine/scene';
import { createRng } from '@/lib/rng';
import { MISTAKE_LABELS } from '@/trace/asks';
import { heroInput } from './hero';

/** Stills are cropped to the array (no empty grid to the right), so they stay
 *  legible when scaled down to a phone column. */
export function stillWidth(n: number): number {
  return n * ARRAY_MAX_CELL + 2 * PAD;
}
/** Seed of the "fresh input" still, fixed so the page is the same for everyone. */
export const RETRACE_SEED = 'landing-retrace';

export interface Still {
  scene: Scene;
  layout: Layout;
  /** Accessible description of what the still shows. */
  label: string;
  /** Prompt (predict, re-trace) or rule (reveal) printed under the still. */
  caption: string;
  /** Wrong pick drawn as a ghost (reveal only). */
  ghost: Id | null;
  /** Mistake kind label for the ghost (reveal only). */
  kind: string | null;
}

export interface Stills {
  predict: Still;
  reveal: Still;
  retrace: Still & { input: BinarySearchInput };
}

function prepare(input: BinarySearchInput, width: number) {
  const r = run(binarySearch.initialState(input), binarySearch.generate(input), { maxSteps: binarySearch.meta.caps.maxSteps });
  const layout = computeLayout(r, { width });
  const asks = askIndices(r.steps, 'guided');
  const at = (k: number): Scene => {
    const state = r.states[k];
    if (!state) throw new Error(`no state at ${k}`);
    return buildScene(state, layout, { width });
  };
  return { r, layout, asks, at };
}

const list = (a: readonly number[]) => a.join(', ');

export function landingStills(): Stills {
  const input = heroInput();
  const fresh = binarySearch.randomInput(createRng(RETRACE_SEED), 'present');
  // One width for every still so a cell is the same size in all three.
  const width = stillWidth(Math.max(input.a.length, fresh.a.length));
  const hero = prepare(input, width);
  const first = hero.asks[0];
  const second = hero.asks[1];
  if (first === undefined || second === undefined) throw new Error('hero input needs two guided asks');
  const firstAsk = hero.r.steps[first]?.ask;
  const secondAsk = hero.r.steps[second]?.ask;
  if (!firstAsk || secondAsk?.kind !== 'pick') throw new Error('hero asks changed shape');
  const wrong = secondAsk.distractors[0];
  if (!wrong) throw new Error('second hero ask has no distractor');

  const later = prepare(fresh, width);
  const laterFirst = later.asks[0];
  const laterAsk = laterFirst === undefined ? undefined : later.r.steps[laterFirst]?.ask;
  if (laterFirst === undefined || !laterAsk) throw new Error('fresh input has no ask');

  return {
    predict: {
      scene: hero.at(first),
      layout: hero.layout,
      label: `Array ${list(input.a)}, searching for ${input.x}. lo is at 0 and hi at ${input.a.length - 1}; mid is not placed yet.`,
      caption: firstAsk.prompt,
      ghost: null,
      kind: null,
    },
    reveal: {
      // The state after the answered step: the real pointer has moved.
      scene: hero.at(second + 1),
      layout: hero.layout,
      label: `After the move. A dashed red outline marks the wrong guess, index ${wrong.answer.replace('e:', '')}; the real pointer is at index ${secondAsk.answer.replace('e:', '')}.`,
      caption: wrong.rule,
      ghost: wrong.answer,
      kind: MISTAKE_LABELS[wrong.kind],
    },
    retrace: {
      scene: later.at(laterFirst),
      layout: later.layout,
      label: `A new array, ${list(fresh.a)}, searching for ${fresh.x}.`,
      caption: laterAsk.prompt,
      ghost: null,
      kind: null,
      input: fresh,
    },
  };
}
