/** Which random input exercises which mistake. For every (algorithm, MistakeKind)
 *  pair that a module can actually produce and that some input shape makes more
 *  likely, the table names the module's `randomInput` target and says, in one
 *  plain clause, what that input has. Pure data; the unit test checks every
 *  target against the module (valid, really has the case, and the trace asks a
 *  question that can go wrong in this way).
 *
 *  Kinds with no entry have no input that helps: 'unclassified' (the wrong answer
 *  matched no known misconception) and kinds the algorithm never asks about. */

import type { MistakeKind } from '@/trace/asks';

export interface MistakeTarget {
  /** Target string accepted by the module's `randomInput(rng, target)`. */
  target: string;
  /** What the generated input has: the first half of a sentence, no colon, no full stop. */
  has: string;
}

type Table = Readonly<Record<string, Readonly<Partial<Record<MistakeKind, MistakeTarget>>>>>;

const BS_ABSENT: MistakeTarget = { target: 'absent', has: 'The target is not in this array, so the loop runs until the range is empty' };

export const MISTAKE_TARGETS: Table = {
  'binary-search': {
    boundary: BS_ABSENT,
    comparison: BS_ABSENT,
    'base-case': BS_ABSENT,
  },
  'quick-sort': {
    comparison: { target: 'duplicates', has: 'This array has repeated values, and a value equal to the pivot is not smaller than it' },
    'base-case': { target: 'sorted', has: 'This array is already sorted, so many segments come out empty' },
    order: { target: 'distinct', has: 'Every value in this array is different, so each pivot splits its segment into a smaller and a larger side' },
    boundary: { target: 'reverse', has: 'This array is in reverse order, so the first pivot is the smallest value and lands at the front' },
  },
  // A stale pop needs a distance that improves through another node while the
  // old entry is still queued, so 'stale' also carries the other three kinds.
  dijkstra: {
    stale: { target: 'stale', has: 'This graph has a stale entry that pops, because a distance improves after it was pushed' },
    comparison: { target: 'stale', has: 'In this graph a distance improves after it was first set' },
    dependency: { target: 'stale', has: 'In this graph a distance improves by going through another node first' },
    order: { target: 'stale', has: 'In this graph one node is in the queue twice at the same time' },
  },
  bst: {
    subtree: { target: 'one-child', has: 'This input deletes a node with one child, so that child and its subtree move up' },
    'base-case': { target: 'two-children', has: 'This input deletes a node with two children, so you pick a delete case twice' },
  },
  'insertion-sort': {
    comparison: { target: 'duplicates', has: 'This array has repeated values, so a key meets an equal value and stops' },
    'shift-vs-swap': { target: 'reverse', has: 'This array is in reverse order, so every key slides all the way to the front' },
    boundary: { target: 'distinct', has: 'Every value in this array is different, so each key stops at its own place in the sorted part' },
  },
  'merge-sort': {
    order: { target: 'duplicates', has: 'This array has repeated values, so two equal fronts meet in a merge' },
    comparison: { target: 'distinct', has: 'Every value in this array is different, so every copy takes the strictly smaller front' },
    boundary: { target: 'odd-length', has: 'This array has an odd length, so the halves are not the same size' },
  },
  bfs: {
    order: { target: 'wide', has: 'In this graph the queue holds three or more nodes at once' },
    boundary: { target: 'connected', has: 'Every node in this graph is reachable, so every node gets a dist' },
  },
  knapsack: {
    dependency: { target: 'tie', has: 'Here taking and skipping an item give the same value on the way back' },
    comparison: { target: 'partial', has: 'These items weigh more than the bag holds, so not every item fits' },
  },
  dfs: {
    order: { target: 'back-edge', has: 'This graph has a cycle, so dfs meets a node that is still on the call stack' },
    boundary: { target: 'deep', has: 'In this graph dfs goes at least five calls deep before it returns' },
    'base-case': { target: 'forest', has: 'This graph falls into separate pieces, so dfs starts again from a new node' },
  },
  lcs: {
    comparison: { target: 'tie', has: 'In these strings the walk back meets a tie between up and left' },
    dependency: { target: 'long', has: 'These strings share a subsequence of at least three letters' },
    boundary: { target: 'long', has: 'These strings share a subsequence of at least three letters' },
  },
};

/** How a kind reads after "recently you stumbled most on …". */
export const KIND_STUMBLE: Record<MistakeKind, string> = {
  boundary: 'boundaries and off-by-one steps',
  comparison: 'the direction of a comparison',
  order: 'the order things come out in',
  stale: 'stale entries',
  'base-case': 'base cases and which case applies',
  subtree: 'which subtree comes next',
  'shift-vs-swap': 'shifting versus swapping',
  dependency: 'what a step reads from',
  unclassified: 'steps that fit no common pattern',
};

/** The target for a kind in an algorithm, or null when no input helps. */
export function targetFor(algorithm: string, kind: MistakeKind): MistakeTarget | null {
  return MISTAKE_TARGETS[algorithm]?.[kind] ?? null;
}

/** Kinds that have a target for this algorithm. */
export function targetedKinds(algorithm: string): MistakeKind[] {
  return Object.keys(MISTAKE_TARGETS[algorithm] ?? {}) as MistakeKind[];
}

/** One sentence: "This graph has a stale entry that pops, …: recently you
 *  stumbled most on stale entries." Null when the kind has no target here. */
export function targetSentence(algorithm: string, kind: MistakeKind): string | null {
  const t = targetFor(algorithm, kind);
  if (!t) return null;
  return `${t.has}: recently you stumbled most on ${KIND_STUMBLE[kind]}.`;
}
