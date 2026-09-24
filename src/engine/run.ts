/** Runs a generator to completion and keeps every state (docs/ARCHITECTURE.md §2–3).
 *  states[0] is the initial state; states[k] is the state after steps[k-1]. */

import type { Step } from './events';
import { apply } from './reducer';
import type { State } from './state';

export interface Run {
  steps: Step[];
  states: State[];
  /** True when the step cap was hit and the run was truncated. */
  truncated: boolean;
}

export const DEFAULT_MAX_STEPS = 600;

export function run(initial: State, steps: Iterable<Step>, caps: { maxSteps?: number } = {}): Run {
  const maxSteps = caps.maxSteps ?? DEFAULT_MAX_STEPS;
  const outSteps: Step[] = [];
  const states: State[] = [initial];
  let truncated = false;
  let current = initial;
  for (const step of steps) {
    if (outSteps.length >= maxSteps) {
      truncated = true;
      break;
    }
    current = apply(current, step);
    outSteps.push(step);
    states.push(current);
  }
  if (truncated) {
    const stop: Step = { line: 0, events: [], note: 'Step limit reached: the input is too large to trace here.' };
    outSteps.push(stop);
    states.push(apply(current, stop));
  }
  return { steps: outSteps, states, truncated };
}

/** Index of every step that carries an ask at or below the given level. */
export function askIndices(steps: readonly Step[], level: 'guided' | 'full'): number[] {
  const out: number[] = [];
  steps.forEach((s, i) => {
    if (!s.ask) return;
    if (level === 'full' || s.ask.level === 'guided') out.push(i);
  });
  return out;
}
