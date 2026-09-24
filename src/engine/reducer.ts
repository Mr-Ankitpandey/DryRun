/** Pure reducer: state[k] = apply(state[k-1], step[k]). Throws on impossible
 *  events; that is an authoring bug and the property tests will surface it.
 *  Structural sharing: only the maps a step touches are copied. */

import type { Id, PanelItem, Slot, Step, VizEvent } from './events';
import { cellKey, ids } from './ids';
import type { ArrayState, GridCell, State, TreeNode } from './state';
import { elementAt, refToId, slotOf } from './state';

class EngineError extends Error {
  constructor(message: string) {
    super(`engine: ${message}`);
  }
}

export function apply(prev: State, step: Step): State {
  let s: State = { ...prev, transient: { compares: [], reads: [], skips: [] } };
  for (const ev of step.events) s = applyEvent(s, ev);
  return s;
}

export function applyEvent(s: State, ev: VizEvent): State {
  switch (ev.t) {
    // ---- transient
    case 'compare':
      refToId(s, ev.a);
      refToId(s, ev.b);
      return {
        ...s,
        transient: {
          ...s.transient,
          compares: [...s.transient.compares, ev.result ? { a: ev.a, b: ev.b, result: ev.result } : { a: ev.a, b: ev.b }],
        },
      };
    case 'read':
      refToId(s, ev.ref);
      return { ...s, transient: { ...s.transient, reads: [...s.transient.reads, ev.ref] } };
    case 'skip':
      refToId(s, ev.ref);
      return { ...s, transient: { ...s.transient, skips: [...s.transient.skips, { ref: ev.ref, reason: ev.reason }] } };

    // ---- arrays
    case 'array': {
      if (ev.size < 0) throw new EngineError(`array ${ev.name}: negative size`);
      const existing = s.arrays[ev.name];
      const slots: (Id | null)[] = existing ? existing.slots.slice(0, ev.size) : [];
      while (slots.length < ev.size) slots.push(null);
      if (existing) {
        for (let i = ev.size; i < existing.slots.length; i++) {
          if (existing.slots[i]) throw new EngineError(`array ${ev.name}: shrinking over element at ${i}`);
        }
      }
      return { ...s, arrays: { ...s.arrays, [ev.name]: { name: ev.name, slots } } };
    }
    case 'move': {
      if (!s.elements[ev.id]) throw new EngineError(`move: unknown element ${ev.id}`);
      const from = slotOf(s, ev.id);
      const occupant = elementAt(s, ev.to);
      if (occupant !== null && occupant !== ev.id) {
        throw new EngineError(`move: slot ${ev.to.arr}[${ev.to.i}] occupied by ${occupant}`);
      }
      const arrays = { ...s.arrays };
      if (from) arrays[from.arr] = setSlot(arrays[from.arr] as ArrayState, from.i, null);
      arrays[ev.to.arr] = setSlot(arrays[ev.to.arr] as ArrayState, ev.to.i, ev.id);
      return { ...s, arrays };
    }
    case 'swap': {
      const a = elementAt(s, ev.a);
      const b = elementAt(s, ev.b);
      if (a === null || b === null) throw new EngineError(`swap: empty slot`);
      if (ev.a.arr === ev.b.arr && ev.a.i === ev.b.i) return s;
      const arrays = { ...s.arrays };
      arrays[ev.a.arr] = setSlot(arrays[ev.a.arr] as ArrayState, ev.a.i, b);
      arrays[ev.b.arr] = setSlot(arrays[ev.b.arr] as ArrayState, ev.b.i, a);
      return { ...s, arrays };
    }
    case 'set': {
      const existing = elementAt(s, ev.slot);
      if (existing !== null) {
        const el = s.elements[existing];
        if (!el) throw new EngineError(`set: dangling element ${existing}`);
        return { ...s, elements: { ...s.elements, [existing]: { ...el, value: ev.value } } };
      }
      const counter = s.counter + 1;
      const id = ids.elIn(ev.slot.arr, ev.slot.i, counter);
      return {
        ...s,
        counter,
        elements: { ...s.elements, [id]: { id, value: ev.value, mark: null } },
        arrays: { ...s.arrays, [ev.slot.arr]: setSlot(s.arrays[ev.slot.arr] as ArrayState, ev.slot.i, id) },
      };
    }
    case 'clear': {
      const existing = elementAt(s, ev.slot);
      if (existing === null) return s;
      return {
        ...s,
        elements: omit(s.elements, existing),
        arrays: { ...s.arrays, [ev.slot.arr]: setSlot(s.arrays[ev.slot.arr] as ArrayState, ev.slot.i, null) },
      };
    }

    // ---- annotations
    case 'pointer': {
      if (ev.at) {
        const arr = s.arrays[ev.at.arr];
        if (!arr) throw new EngineError(`pointer ${ev.name}: no array ${ev.at.arr}`);
        // Carets may sit one before the first cell (-1) or one past the last (size).
        if (ev.at.i < -1 || ev.at.i > arr.slots.length) {
          throw new EngineError(`pointer ${ev.name}: index ${ev.at.i} outside [-1, ${arr.slots.length}]`);
        }
      }
      return { ...s, pointers: { ...s.pointers, [ev.name]: ev.at } };
    }
    case 'var':
      return { ...s, vars: { ...s.vars, [ev.name]: ev.value } };
    case 'region': {
      const arr = s.arrays[ev.arr];
      if (!arr) throw new EngineError(`region ${ev.name}: no array ${ev.arr}`);
      if (ev.range) {
        const [lo, hi] = ev.range;
        if (lo < 0 || hi >= arr.slots.length || lo > hi + 1) {
          throw new EngineError(`region ${ev.name}: bad range [${lo}, ${hi}] for size ${arr.slots.length}`);
        }
      }
      return { ...s, regions: { ...s.regions, [ev.name]: { kind: ev.kind, arr: ev.arr, range: ev.range } } };
    }
    case 'mark': {
      const id = refToId(s, ev.ref);
      if (id === null) throw new EngineError(`mark: ref does not denote an element`);
      const el = s.elements[id];
      if (el) return { ...s, elements: { ...s.elements, [id]: { ...el, mark: ev.as } } };
      const node = s.tree[id];
      if (node) return { ...s, tree: { ...s.tree, [id]: { ...node, mark: ev.as } } };
      if (s.graph) {
        const idx = s.graph.nodes.findIndex((n) => n.id === id);
        if (idx !== -1) {
          const nodes = s.graph.nodes.slice();
          const gn = nodes[idx];
          if (gn) nodes[idx] = { ...gn, mark: ev.as };
          return { ...s, graph: { ...s.graph, nodes } };
        }
      }
      if (s.grid && 'cell' in ev.ref) {
        const key = cellKey(ev.ref.cell[0], ev.ref.cell[1]);
        const cell = s.grid.cells[key];
        if (cell) return { ...s, grid: { ...s.grid, cells: { ...s.grid.cells, [key]: { ...cell, mark: ev.as } } } };
      }
      throw new EngineError(`mark: unknown target ${id}`);
    }

    // ---- panels
    case 'panel':
      return { ...s, panels: { ...s.panels, [ev.panel]: { kind: ev.kind, items: [] } } };
    case 'push': {
      const panel = s.panels[ev.panel];
      if (!panel) throw new EngineError(`push: no panel ${ev.panel}`);
      if (panel.items.some((it) => it.id === ev.item.id)) throw new EngineError(`push: duplicate item ${ev.item.id}`);
      const items = [...panel.items, ev.item];
      if (panel.kind === 'pq') items.sort(pqOrder);
      return { ...s, panels: { ...s.panels, [ev.panel]: { ...panel, items } } };
    }
    case 'pop': {
      const panel = s.panels[ev.panel];
      if (!panel) throw new EngineError(`pop: no panel ${ev.panel}`);
      const idx = panel.items.findIndex((it) => it.id === ev.itemId);
      if (idx === -1) throw new EngineError(`pop: item ${ev.itemId} not in ${ev.panel}`);
      if (panel.kind === 'stack' && idx !== panel.items.length - 1) throw new EngineError(`pop: ${ev.itemId} is not on top of stack ${ev.panel}`);
      if (panel.kind === 'queue' && idx !== 0) throw new EngineError(`pop: ${ev.itemId} is not at the front of queue ${ev.panel}`);
      if (panel.kind === 'pq' && idx !== 0) throw new EngineError(`pop: ${ev.itemId} is not the minimum of pq ${ev.panel}`);
      const items = panel.items.filter((_, i) => i !== idx);
      return { ...s, panels: { ...s.panels, [ev.panel]: { ...panel, items } } };
    }

    // ---- trees
    case 'node.add': {
      if (s.tree[ev.id]) throw new EngineError(`node.add: duplicate ${ev.id}`);
      const node: TreeNode = { id: ev.id, key: ev.key, parent: ev.parent, left: null, right: null, mark: null };
      return attach({ ...s, tree: { ...s.tree, [ev.id]: node } }, ev.id, ev.parent, ev.side);
    }
    case 'node.detach':
      return detach(s, ev.id);
    case 'node.relink':
      return attach(detach(s, ev.id), ev.id, ev.parent, ev.side);
    case 'node.remove': {
      const node = s.tree[ev.id];
      if (!node) throw new EngineError(`node.remove: unknown ${ev.id}`);
      if (node.left || node.right) throw new EngineError(`node.remove: ${ev.id} still has children`);
      const d = detach(s, ev.id);
      return { ...d, tree: omit(d.tree, ev.id) };
    }
    case 'node.set': {
      const node = s.tree[ev.id];
      if (!node) throw new EngineError(`node.set: unknown ${ev.id}`);
      return { ...s, tree: { ...s.tree, [ev.id]: { ...node, key: ev.key } } };
    }

    // ---- graphs
    case 'graph': {
      const seen = new Set<Id>();
      for (const n of ev.nodes) {
        if (seen.has(n.id)) throw new EngineError(`graph: duplicate node ${n.id}`);
        seen.add(n.id);
      }
      for (const e of ev.edges) {
        if (!seen.has(e.a) || !seen.has(e.b)) throw new EngineError(`graph: edge ${e.id} references unknown node`);
      }
      return {
        ...s,
        graph: {
          nodes: ev.nodes.map((n) => ({ id: n.id, label: n.label, mark: null, text: null })),
          edges: ev.edges.map((e) => (e.w === undefined ? { id: e.id, a: e.a, b: e.b, mark: null } : { id: e.id, a: e.a, b: e.b, w: e.w, mark: null })),
        },
      };
    }
    case 'edge.mark': {
      if (!s.graph) throw new EngineError('edge.mark: no graph');
      const idx = s.graph.edges.findIndex((e) => e.id === ev.id);
      if (idx === -1) throw new EngineError(`edge.mark: unknown edge ${ev.id}`);
      const edges = s.graph.edges.slice();
      const e = edges[idx];
      if (e) edges[idx] = { ...e, mark: ev.as };
      return { ...s, graph: { ...s.graph, edges } };
    }
    case 'label': {
      if (!s.graph) throw new EngineError('label: no graph');
      const idx = s.graph.nodes.findIndex((n) => n.id === ev.id);
      if (idx === -1) throw new EngineError(`label: unknown node ${ev.id}`);
      const nodes = s.graph.nodes.slice();
      const n = nodes[idx];
      if (n) nodes[idx] = { ...n, text: ev.text };
      return { ...s, graph: { ...s.graph, nodes } };
    }

    // ---- grid
    case 'grid':
      if (ev.rowLabels.length !== ev.rows || ev.colLabels.length !== ev.cols) throw new EngineError('grid: label counts must match rows/cols');
      return { ...s, grid: { rows: ev.rows, cols: ev.cols, rowLabels: ev.rowLabels, colLabels: ev.colLabels, cells: {} } };
    case 'cell': {
      if (!s.grid) throw new EngineError('cell: no grid');
      if (ev.r < 0 || ev.r >= s.grid.rows || ev.c < 0 || ev.c >= s.grid.cols) throw new EngineError(`cell: (${ev.r},${ev.c}) outside grid`);
      for (const [r, c] of ev.deps) {
        if (!s.grid.cells[cellKey(r, c)]) throw new EngineError(`cell (${ev.r},${ev.c}): dependency (${r},${c}) not computed yet`);
      }
      const cell: GridCell = { value: ev.value, deps: ev.deps, mark: null };
      return { ...s, grid: { ...s.grid, cells: { ...s.grid.cells, [cellKey(ev.r, ev.c)]: cell } } };
    }

    // ---- recursion
    case 'call': {
      if (s.frames[ev.id]) throw new EngineError(`call: duplicate frame ${ev.id}`);
      if (ev.parent !== null && !s.frames[ev.parent]) throw new EngineError(`call: unknown parent frame ${ev.parent}`);
      return {
        ...s,
        frames: { ...s.frames, [ev.id]: { id: ev.id, label: ev.label, args: ev.args, parent: ev.parent, returned: false } },
        frameOrder: [...s.frameOrder, ev.id],
      };
    }
    case 'return': {
      const top = s.frameOrder[s.frameOrder.length - 1];
      if (top !== ev.id) throw new EngineError(`return: ${ev.id} is not the top frame (${top ?? 'none'})`);
      const frame = s.frames[ev.id];
      if (!frame) throw new EngineError(`return: unknown frame ${ev.id}`);
      const updated = ev.value === undefined ? { ...frame, returned: true } : { ...frame, returned: true, value: ev.value };
      return { ...s, frames: { ...s.frames, [ev.id]: updated }, frameOrder: s.frameOrder.slice(0, -1) };
    }
  }
}

/** Copy of a record without one key (keeps the reducer free of `delete`). */
function omit<T>(rec: Record<string, T>, key: string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k in rec) if (k !== key) out[k] = rec[k] as T;
  return out;
}

function setSlot(arr: ArrayState, i: number, id: Id | null): ArrayState {
  if (i < 0 || i >= arr.slots.length) throw new EngineError(`slot ${arr.name}[${i}] out of range (size ${arr.slots.length})`);
  const slots = arr.slots.slice();
  slots[i] = id;
  return { ...arr, slots };
}

function pqOrder(x: PanelItem, y: PanelItem): number {
  const kx = x.key ?? 0;
  const ky = y.key ?? 0;
  if (kx !== ky) return kx - ky;
  const tx = x.tie ?? 0;
  const ty = y.tie ?? 0;
  if (tx !== ty) return tx - ty;
  return x.id.localeCompare(y.id, 'en', { numeric: true });
}

/** Removes a node from its parent (or from root). The node keeps its subtree. */
function detach(s: State, id: Id): State {
  const node = s.tree[id];
  if (!node) throw new EngineError(`detach: unknown node ${id}`);
  if (node.parent === null) {
    if (s.root !== id) return s; // already floating
    return { ...s, root: null, tree: { ...s.tree, [id]: { ...node, parent: null } } };
  }
  const parent = s.tree[node.parent];
  if (!parent) throw new EngineError(`detach: dangling parent of ${id}`);
  const p: TreeNode = parent.left === id ? { ...parent, left: null } : parent.right === id ? { ...parent, right: null } : parent;
  return { ...s, tree: { ...s.tree, [parent.id]: p, [id]: { ...node, parent: null } } };
}

/** Attaches a floating node under a parent side (or as root). */
function attach(s: State, id: Id, parentId: Id | null, side: 'L' | 'R' | null): State {
  const node = s.tree[id];
  if (!node) throw new EngineError(`attach: unknown node ${id}`);
  if (parentId === null) {
    if (s.root !== null && s.root !== id) throw new EngineError(`attach: root already ${s.root}`);
    return { ...s, root: id, tree: { ...s.tree, [id]: { ...node, parent: null } } };
  }
  if (side === null) throw new EngineError(`attach: side required under ${parentId}`);
  const parent = s.tree[parentId];
  if (!parent) throw new EngineError(`attach: unknown parent ${parentId}`);
  if (parentId === id) throw new EngineError(`attach: ${id} cannot be its own parent`);
  const current = side === 'L' ? parent.left : parent.right;
  if (current !== null && current !== id) throw new EngineError(`attach: ${parentId}.${side} occupied by ${current}`);
  const p: TreeNode = side === 'L' ? { ...parent, left: id } : { ...parent, right: id };
  return { ...s, tree: { ...s.tree, [parentId]: p, [id]: { ...node, parent: parentId } } };
}

export { EngineError };
export type { Slot };
