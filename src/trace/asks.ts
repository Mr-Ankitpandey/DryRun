/** Checkpoint ("ask") types. Declared by generators on the step they precede,
 *  so the correct answer is always computed by the algorithm itself. */

import type { Id } from '@/engine/events';

export type Level = 'guided' | 'full';

export type MistakeKind =
  | 'boundary' // off-by-one, lo<=hi vs lo<hi, wrong mid
  | 'comparison' // direction of the comparison
  | 'order' // wrong structure order (queue vs stack, PQ pop order)
  | 'stale' // acted on a stale PQ entry
  | 'base-case' // missed base case / termination
  | 'subtree' // wrong side of the tree
  | 'shift-vs-swap' // insertion sort mechanics
  | 'dependency' // DP cell read wrong neighbours
  | 'unclassified';

export interface Distractor<A> {
  answer: A;
  kind: MistakeKind;
  rule: string;
}

interface AskBase {
  prompt: string;
  level: Level;
  /** Rule shown when the wrong answer matches no distractor. */
  rule: string;
}

export interface PickAsk extends AskBase {
  kind: 'pick';
  answer: Id;
  /** Clickable set. Must contain `answer`. */
  candidates: Id[];
  distractors: Distractor<Id>[];
}

export interface ValueAsk extends AskBase {
  kind: 'value';
  answer: number;
  distractors: Distractor<number>[];
}

export interface OrderAsk extends AskBase {
  kind: 'order';
  /** Exact sequence; the prompt states the order convention (e.g. "front first"). */
  answer: Id[];
  pool: Id[];
  distractors: Distractor<Id[]>[];
}

export interface ChoiceAsk extends AskBase {
  kind: 'choice';
  answer: string;
  options: string[];
  distractors: Distractor<string>[];
}

export type Ask = PickAsk | ValueAsk | OrderAsk | ChoiceAsk;

export type Answer = Id | number | Id[] | string;

export const MISTAKE_LABELS: Record<MistakeKind, string> = {
  boundary: 'Boundary / off-by-one',
  comparison: 'Comparison direction',
  order: 'Structure order',
  stale: 'Stale entry',
  'base-case': 'Base case / termination',
  subtree: 'Wrong subtree',
  'shift-vs-swap': 'Shift vs swap',
  dependency: 'Wrong dependency',
  unclassified: 'Other',
};
