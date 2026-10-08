/** Runs a real algorithm module exactly as the app does, so every frame of the
 *  ad shows a true state: same generator, reducer, layout and scene builder. */

import type { AlgorithmModule } from '@/algorithms/types';
import type { Step } from '@/engine/events';
import type { Layout } from '@/engine/layout';
import { computeLayout } from '@/engine/layout';
import { run } from '@/engine/run';
import type { Run } from '@/engine/run';
import type { Scene } from '@/engine/scene';
import { buildScene } from '@/engine/scene';

/** Abstract stage width the app lays out at (desktop); the SVG scales it. */
export const LAYOUT_WIDTH = 900;

export interface Trace {
  run: Run;
  layout: Layout;
  /** scene[k] = the stage at timeline index k (0 = before any step). */
  scenes: Scene[];
  steps: readonly Step[];
}

export function traceOf<I>(mod: AlgorithmModule<I>, input: I): Trace {
  const r = run(mod.initialState(input), mod.generate(input), { maxSteps: mod.meta.caps.maxSteps });
  const layout = computeLayout(r, { width: LAYOUT_WIDTH });
  const scenes = r.states.map((s) => buildScene(s, layout, { width: LAYOUT_WIDTH }));
  return { run: r, layout, scenes, steps: r.steps };
}

/** Index k of the first step matching `pred` (its ask is asked before it applies). */
export function findStep(t: Trace, pred: (step: Step, k: number) => boolean): number {
  const k = t.steps.findIndex((s, i) => pred(s, i));
  if (k < 0) throw new Error('ad: step not found in trace');
  return k;
}

export function presetInput<I>(mod: AlgorithmModule<I>, id: string): I {
  const p = mod.presets.find((x) => x.id === id);
  if (!p) throw new Error(`ad: preset ${id} not found in ${mod.meta.id}`);
  return p.input;
}
