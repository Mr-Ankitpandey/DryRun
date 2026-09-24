/** Immutable engine state. Plain data only (no Map/Set) so states can be
 *  compared structurally in tests and serialised if ever needed. */

import type { ArrayName, EdgeMark, Id, MarkKind, PanelItem, PanelKind, Ref, RegionKind, Scalar, Slot } from './events';
import { ids } from './ids';

export interface ElementState {
  id: Id;
  value: number;
  mark: MarkKind | null;
}

export interface ArrayState {
  name: ArrayName;
  slots: (Id | null)[];
}

export interface Region {
  kind: RegionKind;
  arr: ArrayName;
  range: [number, number] | null;
}

export interface PanelState {
  kind: PanelKind;
  items: PanelItem[];
}

export interface TreeNode {
  id: Id;
  key: number;
  parent: Id | null;
  left: Id | null;
  right: Id | null;
  mark: MarkKind | null;
}

export interface GraphNode {
  id: Id;
  label: string;
  mark: MarkKind | null;
  text: string | null;
}

export interface GraphEdge {
  id: Id;
  a: Id;
  b: Id;
  w?: number;
  mark: EdgeMark | null;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GridCell {
  value: number;
  deps: [number, number][];
  mark: MarkKind | null;
}

export interface GridState {
  rows: number;
  cols: number;
  rowLabels: string[];
  colLabels: string[];
  cells: Record<string, GridCell>; // key: `${r},${c}` (see ids.cellKey)
}

export interface Frame {
  id: Id;
  label: string;
  args: Record<string, Scalar>;
  parent: Id | null;
  returned: boolean;
  value?: Scalar;
}

export interface Transient {
  compares: { a: Ref; b: Ref; result?: '<' | '=' | '>' }[];
  reads: Ref[];
  skips: { ref: Ref; reason: string }[];
}

export interface State {
  elements: Record<Id, ElementState>;
  arrays: Record<ArrayName, ArrayState>;
  pointers: Record<string, Slot | null>;
  vars: Record<string, Scalar>;
  regions: Record<string, Region>;
  panels: Record<string, PanelState>;
  tree: Record<Id, TreeNode>;
  root: Id | null;
  graph: GraphState | null;
  grid: GridState | null;
  frames: Record<Id, Frame>;
  /** Open frames, bottom first. */
  frameOrder: Id[];
  transient: Transient;
  /** Per-run counter for minted ids. */
  counter: number;
}

export function emptyState(): State {
  return {
    elements: {},
    arrays: {},
    pointers: {},
    vars: {},
    regions: {},
    panels: {},
    tree: {},
    root: null,
    graph: null,
    grid: null,
    frames: {},
    frameOrder: [],
    transient: { compares: [], reads: [], skips: [] },
    counter: 0,
  };
}

/** Builder used by modules' `initialState`: adds an array whose elements get
 *  ids `e:<i>` (main array) or `e:<name>:<i>#0` for secondary arrays. */
export function withArray(state: State, name: ArrayName, values: readonly number[], main = name === 'a'): State {
  const elements = { ...state.elements };
  const slots: (Id | null)[] = [];
  values.forEach((value, i) => {
    const id = main ? ids.el(i) : ids.elIn(name, i, 0);
    if (elements[id]) throw new Error(`withArray: duplicate element id ${id}`);
    elements[id] = { id, value, mark: null };
    slots.push(id);
  });
  return { ...state, elements, arrays: { ...state.arrays, [name]: { name, slots } } };
}

/** Current values of an array in slot order (null for empty slots). */
export function arrayValues(state: State, name: ArrayName): (number | null)[] {
  const arr = state.arrays[name];
  if (!arr) throw new Error(`arrayValues: no array ${name}`);
  return arr.slots.map((id) => (id === null ? null : (state.elements[id]?.value ?? null)));
}

/** Element id at a slot, or null when empty. Throws when out of range. */
export function elementAt(state: State, slot: Slot): Id | null {
  const arr = state.arrays[slot.arr];
  if (!arr) throw new Error(`elementAt: no array ${slot.arr}`);
  if (slot.i < 0 || slot.i >= arr.slots.length) {
    throw new Error(`elementAt: slot ${slot.arr}[${slot.i}] out of range (size ${arr.slots.length})`);
  }
  return arr.slots[slot.i] ?? null;
}

/** Finds which slot holds an element. */
export function slotOf(state: State, id: Id): Slot | null {
  for (const arr of Object.values(state.arrays)) {
    const i = arr.slots.indexOf(id);
    if (i !== -1) return { arr: arr.name, i };
  }
  return null;
}

/** Open frame on top of the call stack, if any. */
export function topFrame(state: State): Frame | null {
  const id = state.frameOrder[state.frameOrder.length - 1];
  return id === undefined ? null : (state.frames[id] ?? null);
}

/** Resolves a Ref to a concrete element/node id when it denotes one. */
export function refToId(state: State, ref: Ref): Id | null {
  if ('id' in ref) return ref.id;
  if ('arr' in ref) return elementAt(state, ref);
  if ('cell' in ref) return ids.cell(ref.cell[0], ref.cell[1]);
  return null;
}
