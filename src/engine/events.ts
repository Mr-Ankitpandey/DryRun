/** The engine contract. Semantic events are what algorithms emit; everything
 *  visual is derived from them. No algorithm names appear in this file or in the
 *  reducer. See docs/ARCHITECTURE.md §1. */

import type { Ask } from '@/trace/asks';

/** Stable identity of a visual thing. Minted via src/engine/ids.ts. */
export type Id = string;
export type ArrayName = string;
export type Scalar = number | string | boolean | null;

/** A position in a named array. `i` may equal the array size for pointers
 *  that sit one past the end (e.g. `hi = n` in lower-bound search). */
export interface Slot {
  arr: ArrayName;
  i: number;
}

export type Ref = { id: Id } | Slot | { var: string } | { cell: [number, number] };

export type MarkKind =
  | 'visited'
  | 'frontier'
  | 'settled'
  | 'active'
  | 'pivot'
  | 'key'
  | 'done'
  | 'stale';

/** 'ordered': slots where the structure's order already holds (bottom-up
 *  build-heap: every slot after k heads a valid heap). */
export type RegionKind = 'sorted' | 'eliminated' | 'less' | 'greaterEq' | 'unscanned' | 'window' | 'ordered';
export type EdgeMark = 'relaxed' | 'tree' | 'rejected';
export type PanelKind = 'stack' | 'queue' | 'pq' | 'callstack' | 'vars';
export type CompareResult = '<' | '=' | '>';

export interface PanelItem {
  id: Id;
  label: string;
  /** Priority for 'pq' panels (smaller pops first). */
  key?: number;
  /** Secondary order for equal keys in 'pq' panels (e.g. node index). Falls back to id. */
  tie?: number;
  /** The element/node this item stands for (drives linked-view highlighting). */
  ref?: Id;
  meta?: Record<string, Scalar>;
}

export type VizEvent =
  // ---- transient: cleared at the start of the next step
  | { t: 'compare'; a: Ref; b: Ref; result?: CompareResult }
  | { t: 'read'; ref: Ref }
  | { t: 'skip'; ref: Ref; reason: string }
  // ---- arrays
  | { t: 'array'; name: ArrayName; size: number }
  /** Also draw array `arr` as the implicit binary tree of its slots (slot i's
   *  children are 2i + 1 and 2i + 2). Declares a view only; no data changes. */
  | { t: 'array.tree'; arr: ArrayName }
  /** Draw array `arr` as equal-height cells: its values are labels (ids,
   *  pointers), not magnitudes. Declares a view only; no data changes. */
  | { t: 'array.flat'; arr: ArrayName }
  | { t: 'move'; id: Id; to: Slot }
  | { t: 'swap'; a: Slot; b: Slot }
  | { t: 'set'; slot: Slot; value: number }
  | { t: 'clear'; slot: Slot }
  // ---- annotations
  | { t: 'pointer'; name: string; at: Slot | null }
  | { t: 'var'; name: string; value: Scalar }
  | { t: 'region'; name: string; kind: RegionKind; arr: ArrayName; range: [number, number] | null }
  | { t: 'mark'; ref: Ref; as: MarkKind | null }
  // ---- panels
  | { t: 'panel'; panel: string; kind: PanelKind }
  | { t: 'push'; panel: string; item: PanelItem }
  | { t: 'pop'; panel: string; itemId: Id }
  // ---- trees
  | { t: 'node.add'; id: Id; key: number; parent: Id | null; side: 'L' | 'R' | null }
  | { t: 'node.detach'; id: Id }
  | { t: 'node.relink'; id: Id; parent: Id | null; side: 'L' | 'R' | null }
  | { t: 'node.remove'; id: Id }
  | { t: 'node.set'; id: Id; key: number }
  /** Switches an empty tree to a forest: any number of parentless nodes, and
   *  `node.add` / `node.relink` with side null attach under a parent with any
   *  number of children (read from parent pointers, not left/right). */
  | { t: 'forest' }
  // ---- graphs (topology fixed at load; only marks and labels change)
  /** `directed: true` makes every edge an arc a → b (ids from `ids.arc`). */
  | { t: 'graph'; nodes: { id: Id; label: string }[]; edges: { id: Id; a: Id; b: Id; w?: number }[]; directed?: true }
  | { t: 'edge.mark'; id: Id; as: EdgeMark | null }
  /** Text under a graph node, or under a tree node (forest ranks). */
  | { t: 'label'; id: Id; text: string | null }
  // ---- DP grid
  | { t: 'grid'; rows: number; cols: number; rowLabels: string[]; colLabels: string[] }
  | { t: 'cell'; r: number; c: number; value: number; deps: [number, number][] }
  // ---- recursion
  | { t: 'call'; id: Id; label: string; args: Record<string, Scalar>; parent: Id | null }
  | { t: 'return'; id: Id; value?: Scalar };

export interface Step {
  /** 1-based pseudocode line. */
  line: number;
  events: VizEvent[];
  /** One sentence, present tense, names the rule. */
  note: string;
  /** Present when this step is a checkpoint. Asked BEFORE the step applies. */
  ask?: Ask;
  /** Optional grouping for timeline ticks ('partition', 'merge', 'relax'). */
  phase?: string;
}
