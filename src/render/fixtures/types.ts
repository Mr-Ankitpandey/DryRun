/** A synthetic trace authored as plain `Step[]` to exercise the renderers before
 *  the real algorithm modules land. Plain data: no React, no DOM. */

import type { Step } from '@/engine/events';
import type { State } from '@/engine/state';

export interface Fixture {
  id: string;
  title: string;
  pseudocode: string[];
  initial: State;
  steps: Step[];
}
