/** Scene builder (docs/ARCHITECTURE.md §4): `buildScene(state, layout, viewport)`
 *  turns one exact State into keyed primitives. Pure, no React. Every prim id
 *  comes from the state (element id, `p:<name>`, `r:<name>`, node id,
 *  `te:<child>`, edge id, cell id, panel item id, frame id, `cmp:<a>:<b>`), never
 *  from an array index, so the renderer can diff scene[k-1] → scene[k] by id and
 *  animate only what moved. A bar's x is the slot it occupies now: when `e:3`
 *  moves from slot 3 to slot 5 the same prim (and the same <g>) travels. */

import type { ArrayName, CompareResult, EdgeMark, Id, MarkKind, PanelKind, Ref, RegionKind, Scalar } from './events';
import { ids } from './ids';
import type { Layout } from './layout';
import { floatOrigin, pathOf, slotCenter, topOf, treePos } from './layout';
import type { State } from './state';
import { refToId } from './state';

export type LinkStyle = 'compare' | 'read' | 'dep';

export interface BarPrim {
  kind: 'bar';
  id: Id;
  x: number;
  y: number;
  w: number;
  h: number;
  value: number;
  mark: MarkKind | null;
  arr: ArrayName;
  index: number;
  read: boolean;
  compared: boolean;
  skipped: boolean;
}
export interface CaretPrim {
  kind: 'caret';
  id: `p:${string}`;
  name: string;
  x: number;
  y: number;
  visible: boolean;
}
export interface RegionPrim {
  kind: 'region';
  id: `r:${string}`;
  name: string;
  kind2: RegionKind;
  arr: ArrayName;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}
export interface TNodePrim {
  kind: 'tnode';
  id: Id;
  x: number;
  y: number;
  key: number;
  mark: MarkKind | null;
  read: boolean;
  compared: boolean;
  floating: boolean;
}
export interface TEdgePrim {
  kind: 'tedge';
  id: `te:${Id}`;
  child: Id;
  parent: Id;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface GNodePrim {
  kind: 'gnode';
  id: Id;
  x: number;
  y: number;
  label: string;
  text: string | null;
  mark: MarkKind | null;
  read: boolean;
  compared: boolean;
  skipped: boolean;
}
export interface GEdgePrim {
  kind: 'gedge';
  id: Id;
  a: Id;
  b: Id;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number | null;
  mark: EdgeMark | null;
}
export interface CellPrim {
  kind: 'cell';
  id: Id;
  r: number;
  c: number;
  x: number;
  y: number;
  w: number;
  h: number;
  value: number | null;
  deps: Id[];
  /** The cell being computed now (mark 'active'). */
  fresh: boolean;
  mark: MarkKind | null;
  read: boolean;
}
export interface RowPrim {
  kind: 'row';
  id: Id;
  panel: string;
  panelKind: PanelKind;
  order: number;
  label: string;
  key: number | null;
  /** Secondary text: a var's value, a call frame's args. */
  text: string | null;
  stale: boolean;
  /** Element/node/frame this row stands for (linked-view hover). */
  ref: Id | null;
}
export interface FramePrim {
  kind: 'frame';
  id: Id;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  label: string;
  /** Top of the call stack. */
  active: boolean;
  /** Still on the call stack. */
  open: boolean;
  returned: boolean;
  value: Scalar | null;
}
export interface FEdgePrim {
  kind: 'fedge';
  id: `fe:${Id}`;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface LinkPrim {
  kind: 'link';
  id: `${'cmp' | 'dep'}:${Id}:${Id}`;
  from: Id;
  to: Id;
  style: LinkStyle;
  result: CompareResult | null;
}

export type Prim = BarPrim | CaretPrim | RegionPrim | TNodePrim | TEdgePrim | GNodePrim | GEdgePrim | CellPrim | RowPrim | FramePrim | FEdgePrim | LinkPrim;

export interface Scene {
  prims: Map<Id, Prim>;
  width: number;
  height: number;
}

/** Panel names for the two implicit panels built from State rather than
 *  from `panels`: the call stack (`frameOrder`) and the variables. */
export const CALLSTACK_PANEL = '$callstack';
export const VARS_PANEL = '$vars';

export const varId = (name: string): Id => `v:${name}`;
export const callRowId = (frameId: Id): Id => `cs:${frameId}`;

export const BAR_MIN_H = 24;

export function buildScene(state: State, layout: Layout, viewport: { width: number }): Scene {
  const prims = new Map<Id, Prim>();
  const put = (p: Prim) => {
    if (prims.has(p.id)) throw new Error(`scene: duplicate prim id ${p.id}`);
    prims.set(p.id, p);
  };
  const hot = transientIds(state);

  // ---- arrays: regions (behind), bars, carets
  if (layout.array) {
    const al = layout.array;
    for (const [name, region] of Object.entries(state.regions)) {
      const row = al.rows[region.arr];
      if (!row) continue;
      const visible = region.range !== null && region.range[1] >= region.range[0];
      const [lo, hi] = region.range ?? [0, -1];
      put({
        kind: 'region',
        id: `r:${name}`,
        name,
        kind2: region.kind,
        arr: region.arr,
        x: row.x0 + (visible ? lo : 0) * row.cellW,
        y: row.y - 6,
        w: visible ? (hi - lo + 1) * row.cellW : 0,
        h: row.barH + 12,
        visible,
      });
    }
    for (const arrName of al.order) {
      const row = al.rows[arrName];
      const arr = state.arrays[arrName];
      if (!row || !arr) continue;
      arr.slots.forEach((id, i) => {
        if (id === null) return;
        const el = state.elements[id];
        if (!el) return;
        const h = BAR_MIN_H + (row.barH - BAR_MIN_H) * (Math.abs(el.value) / al.maxValue);
        put({
          kind: 'bar',
          id,
          x: row.x0 + i * row.cellW,
          y: row.y + row.barH - h,
          w: row.cellW,
          h,
          value: el.value,
          mark: el.mark,
          arr: arrName,
          index: i,
          read: hot.reads.has(id),
          compared: hot.compared.has(id),
          skipped: hot.skips.has(id),
        });
      });
    }
    for (const [name, at] of Object.entries(state.pointers)) {
      const row = at ? al.rows[at.arr] : undefined;
      const home = al.rows[al.order[0] as string];
      const anchor = row ?? home;
      if (!anchor) continue;
      put({
        kind: 'caret',
        id: `p:${name}`,
        name,
        x: at && row ? slotCenter(row, at.i) : anchor.x0,
        y: anchor.caretY,
        visible: at !== null && row !== undefined,
      });
    }
  }

  // ---- recursion tree from frames
  if (layout.recursion) {
    const rl = layout.recursion;
    const top = state.frameOrder[state.frameOrder.length - 1] ?? null;
    const open = new Set(state.frameOrder);
    for (const f of Object.values(state.frames)) {
      const p = rl.pos[f.id];
      if (!p) continue;
      put({
        kind: 'frame',
        id: f.id,
        x: p.x,
        y: p.y,
        w: p.w,
        h: rl.h,
        depth: frameDepth(state, f.id),
        label: `${f.label}(${Object.values(f.args).map(formatScalar).join(',')})`,
        active: f.id === top,
        open: open.has(f.id),
        returned: f.returned,
        value: f.value ?? null,
      });
      if (f.parent !== null) {
        const pp = rl.pos[f.parent];
        if (pp) put({ kind: 'fedge', id: `fe:${f.id}`, x1: p.x, y1: p.y - rl.h / 2, x2: pp.x, y2: pp.y + rl.h / 2 });
      }
    }
  }

  // ---- BST
  if (layout.tree) {
    const tl = layout.tree;
    const floating = [...new Set(Object.keys(state.tree).map((id) => topOf(state, id)))].filter((t) => t !== state.root).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const posOf = (id: Id) => {
      const top = topOf(state, id);
      const path = pathOf(state, id);
      if (top === state.root) return treePos(tl, path);
      return treePos(tl, path, floatOrigin(tl, floating.indexOf(top)));
    };
    const positions = new Map<Id, { x: number; y: number }>();
    for (const id of Object.keys(state.tree)) positions.set(id, posOf(id));
    for (const node of Object.values(state.tree)) {
      const p = positions.get(node.id) as { x: number; y: number };
      put({
        kind: 'tnode',
        id: node.id,
        x: p.x,
        y: p.y,
        key: node.key,
        mark: node.mark,
        read: hot.reads.has(node.id),
        compared: hot.compared.has(node.id),
        floating: topOf(state, node.id) !== state.root,
      });
      if (node.parent !== null) {
        const pp = positions.get(node.parent);
        if (pp) put({ kind: 'tedge', id: `te:${node.id}`, child: node.id, parent: node.parent, x1: p.x, y1: p.y, x2: pp.x, y2: pp.y });
      }
    }
  }

  // ---- graph
  if (layout.graph && state.graph) {
    const gl = layout.graph;
    for (const e of state.graph.edges) {
      const a = gl.pos[e.a];
      const b = gl.pos[e.b];
      if (!a || !b) continue;
      put({ kind: 'gedge', id: e.id, a: e.a, b: e.b, x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: e.w ?? null, mark: e.mark });
    }
    for (const n of state.graph.nodes) {
      const p = gl.pos[n.id];
      if (!p) continue;
      put({
        kind: 'gnode',
        id: n.id,
        x: p.x,
        y: p.y,
        label: n.label,
        text: n.text,
        mark: n.mark,
        read: hot.reads.has(n.id),
        compared: hot.compared.has(n.id),
        skipped: hot.skips.has(n.id),
      });
    }
  }

  // ---- grid
  if (layout.grid && state.grid) {
    const gr = layout.grid;
    for (let r = 0; r < gr.rows; r++) {
      for (let c = 0; c < gr.cols; c++) {
        const id = ids.cell(r, c);
        const cell = state.grid.cells[`${r},${c}`];
        const deps = cell ? cell.deps.map(([dr, dc]) => ids.cell(dr, dc)) : [];
        const fresh = cell?.mark === 'active';
        put({
          kind: 'cell',
          id,
          r,
          c,
          x: gr.x0 + c * gr.cellW,
          y: gr.y0 + r * gr.cellH,
          w: gr.cellW,
          h: gr.cellH,
          value: cell ? cell.value : null,
          deps,
          fresh,
          mark: cell?.mark ?? null,
          read: hot.reads.has(id),
        });
        if (fresh) for (const d of deps) put({ kind: 'link', id: `dep:${id}:${d}`, from: d, to: id, style: 'dep', result: null });
      }
    }
  }

  // ---- panels
  for (const [name, panel] of Object.entries(state.panels)) {
    panel.items.forEach((item, i) => {
      const stale = item.meta?.['stale'] === true || hot.skips.has(item.id) || (item.ref !== undefined && hot.skips.has(item.ref));
      put({
        kind: 'row',
        id: item.id,
        panel: name,
        panelKind: panel.kind,
        order: i,
        label: item.label,
        key: item.key ?? null,
        text: null,
        stale,
        ref: item.ref ?? null,
      });
    });
  }
  state.frameOrder.forEach((fid, i) => {
    const f = state.frames[fid];
    if (!f) return;
    put({ kind: 'row', id: callRowId(fid), panel: CALLSTACK_PANEL, panelKind: 'callstack', order: i, label: f.label, key: null, text: formatArgs(f.args), stale: false, ref: fid });
  });
  Object.entries(state.vars).forEach(([name, value], i) => {
    put({ kind: 'row', id: varId(name), panel: VARS_PANEL, panelKind: 'vars', order: i, label: name, key: null, text: formatScalar(value), stale: false, ref: null });
  });

  // ---- compare links (transient)
  for (const cmp of state.transient.compares) {
    const a = linkEnd(state, cmp.a);
    const b = linkEnd(state, cmp.b);
    if (a === null || b === null) continue;
    const id = `cmp:${a}:${b}` as const;
    if (prims.has(id)) continue;
    put({ kind: 'link', id, from: a, to: b, style: 'compare', result: cmp.result ?? null });
  }

  return { prims, width: viewport.width, height: layout.height };
}

/** Ids touched by this step's transient events. */
function transientIds(state: State): { reads: Set<Id>; compared: Set<Id>; skips: Set<Id> } {
  const reads = new Set<Id>();
  const compared = new Set<Id>();
  const skips = new Set<Id>();
  for (const r of state.transient.reads) {
    const id = linkEnd(state, r);
    if (id !== null) reads.add(id);
  }
  for (const c of state.transient.compares) {
    for (const r of [c.a, c.b]) {
      const id = linkEnd(state, r);
      if (id !== null) compared.add(id);
    }
  }
  for (const s of state.transient.skips) {
    const id = linkEnd(state, s.ref);
    if (id !== null) skips.add(id);
  }
  return { reads, compared, skips };
}

/** Prim id a Ref points at: an element/node/cell id, or a var row id. */
function linkEnd(state: State, ref: Ref): Id | null {
  if ('var' in ref) return varId(ref.var);
  try {
    return refToId(state, ref);
  } catch {
    return null;
  }
}

function frameDepth(state: State, id: Id): number {
  let d = 0;
  let cur = state.frames[id];
  while (cur && cur.parent !== null) {
    cur = state.frames[cur.parent];
    d++;
  }
  return d;
}

export function formatScalar(v: Scalar): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  return String(v);
}

export function formatArgs(args: Record<string, Scalar>): string {
  return Object.entries(args)
    .map(([k, v]) => `${k}=${formatScalar(v)}`)
    .join(', ');
}

/** Prims of one kind, in insertion order. */
export function primsOf<K extends Prim['kind']>(scene: Scene, kind: K): Extract<Prim, { kind: K }>[] {
  const out: Extract<Prim, { kind: K }>[] = [];
  for (const p of scene.prims.values()) if (p.kind === kind) out.push(p as Extract<Prim, { kind: K }>);
  return out;
}

/** Prims that carry a position (link endpoints resolve against these). */
export function positionOf(scene: Scene, id: Id): { x: number; y: number; w: number; h: number } | null {
  const p = scene.prims.get(id);
  if (!p) return null;
  switch (p.kind) {
    case 'bar':
      return { x: p.x + p.w / 2, y: p.y, w: p.w, h: p.h };
    case 'cell':
      return { x: p.x + p.w / 2, y: p.y, w: p.w, h: p.h };
    case 'tnode':
    case 'gnode':
      return { x: p.x, y: p.y, w: 0, h: 0 };
    case 'frame':
      return { x: p.x, y: p.y, w: p.w, h: p.h };
    default:
      return null;
  }
}
