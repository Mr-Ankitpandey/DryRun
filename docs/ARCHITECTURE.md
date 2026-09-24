# DryRun — architecture

Status: draft for owner review. Last updated: 2026-09-25.

Guiding rule: **semantic events are the contract; everything visual is derived.**
The engine never knows which algorithm is running.

```
Event source ──Step[]──▶ reducer ──State[]──▶ scene builder ──Scene──▶ SVG renderer
                                     ▲                                    ▲
                        timeline (index, play, scrub) ─────────────────────┘
                        trace layer (asks, grading, mistakes, review)
```

## 1. Core types (`src/engine/events.ts`, `src/engine/state.ts`)

### Identity

```ts
/** Stable identity of a visual thing. Never reused within one run. */
type Id = string;
// Conventions (only the engine mints these):
//   'e:3'      element created at input index 3 (moves with the value)
//   'e:aux:5'  element created in array 'aux' at index 5
//   'n:7'      tree node with key 7 / graph node 7
//   'g:2-5'    undirected graph edge between nodes 2 and 5 (smaller id first)
//   'c:3,4'    DP grid cell row 3, col 4
//   'f:12'     call frame #12
//   'q:9'      panel item #9

type ArrayName = string;                       // 'a' (main), 'aux', 'heap'
type Slot = { arr: ArrayName; i: number };     // a position; identity lives in the element
type Ref = { id: Id } | Slot | { var: string } | { cell: [number, number] };
type Scalar = number | string | boolean | null;
```

### Events

One `Step` = one semantic change + everything needed to show it. Events inside a
step are applied in order but rendered as one animated transition.

```ts
type MarkKind =
  | 'visited' | 'frontier' | 'settled' | 'active' | 'pivot' | 'key' | 'done' | 'stale';
type RegionKind = 'sorted' | 'eliminated' | 'less' | 'greaterEq' | 'unscanned' | 'window';

type VizEvent =
  // transient (cleared at the start of the next step)
  | { t: 'compare'; a: Ref; b: Ref; result?: '<' | '=' | '>' }
  | { t: 'read'; ref: Ref }
  | { t: 'skip'; ref: Ref; reason: string }           // e.g. stale PQ entry popped
  // arrays
  | { t: 'move'; id: Id; to: Slot }                    // shift / rotate; identity moves
  | { t: 'swap'; a: Slot; b: Slot }                    // sugar: two moves
  | { t: 'set'; slot: Slot; value: number }            // write into slot; mints element if empty
  | { t: 'clear'; slot: Slot }                         // slot becomes empty (aux buffers)
  | { t: 'array'; name: ArrayName; size: number }      // declare/resize an array (aux)
  // annotations
  | { t: 'pointer'; name: string; at: Slot | null }
  | { t: 'var'; name: string; value: Scalar }
  | { t: 'region'; name: string; kind: RegionKind; arr: ArrayName; range: [number, number] | null }
  | { t: 'mark'; ref: Ref; as: MarkKind | null }
  // panels (stack / queue / pq / callstack)
  | { t: 'push'; panel: string; item: PanelItem }
  | { t: 'pop'; panel: string; itemId: Id }            // explicit id: pq pops by priority
  | { t: 'panel'; panel: string; kind: PanelKind }     // declare a panel
  // trees
  | { t: 'node.add'; id: Id; key: number; parent: Id | null; side: 'L' | 'R' | null }
  | { t: 'node.remove'; id: Id }
  | { t: 'node.relink'; id: Id; parent: Id | null; side: 'L' | 'R' | null }
  | { t: 'node.set'; id: Id; key: number }
  // graphs (topology is fixed at load; only marks/labels change)
  | { t: 'edge.mark'; id: Id; as: 'relaxed' | 'tree' | 'rejected' | null }
  | { t: 'label'; id: Id; text: string | null }        // e.g. dist under a node
  // DP grid
  | { t: 'cell'; r: number; c: number; value: number; deps: [number, number][] }
  | { t: 'grid'; rows: number; cols: number; rowLabels: string[]; colLabels: string[] }
  // recursion
  | { t: 'call'; id: Id; label: string; args: Record<string, Scalar>; parent: Id | null }
  | { t: 'return'; id: Id; value?: Scalar };

type PanelKind = 'stack' | 'queue' | 'pq' | 'callstack' | 'vars';
type PanelItem = { id: Id; label: string; key?: number; ref?: Id; meta?: Record<string, Scalar> };
```

### Step

```ts
type Step = {
  line: number;             // pseudocode line (1-based)
  events: VizEvent[];
  note: string;             // one sentence, present tense, ≤ 90 chars
  ask?: Ask;                // if present, this step is a checkpoint (asked BEFORE apply)
  phase?: string;           // optional grouping for timeline ticks ('partition', 'merge')
};
```

The generator yields `Step`s. It is a plain `function*` with no engine dependency:

```ts
type Generator<I> = (input: I, rng: Rng) => Iterable<Step>;
```

### State

Immutable. The reducer returns a new object, sharing untouched sub-objects.

```ts
type ElementState = { id: Id; value: number; mark: MarkKind | null };
type ArrayState = { name: ArrayName; slots: (Id | null)[] };
type PanelState = { kind: PanelKind; items: PanelItem[] };            // pq kept sorted by (key, id)
type TreeNode = { id: Id; key: number; parent: Id | null; left: Id | null; right: Id | null; mark: MarkKind | null };
type GraphState = {
  nodes: { id: Id; label: string; mark: MarkKind | null; text: string | null }[];
  edges: { id: Id; a: Id; b: Id; w?: number; mark: 'relaxed' | 'tree' | 'rejected' | null }[];
};
type GridState = { rows: number; cols: number; rowLabels: string[]; colLabels: string[];
                   cells: Record<string, { value: number; deps: [number, number][] }> };
type Frame = { id: Id; label: string; args: Record<string, Scalar>; parent: Id | null; returned?: Scalar };

type State = {
  elements: Record<Id, ElementState>;
  arrays: Record<ArrayName, ArrayState>;
  pointers: Record<string, Slot | null>;
  vars: Record<string, Scalar>;
  regions: Record<string, { kind: RegionKind; arr: ArrayName; range: [number, number] | null }>;
  panels: Record<string, PanelState>;
  tree: Record<Id, TreeNode>; root: Id | null;
  graph: GraphState | null;
  grid: GridState | null;
  frames: Record<Id, Frame>; frameOrder: Id[];
  transient: { compares: {a: Ref; b: Ref; result?: string}[]; reads: Ref[]; skips: {ref: Ref; reason: string}[] };
};
```

## 2. Reducer (`src/engine/reducer.ts`)

```ts
function apply(prev: State, step: Step): State
```

- Pure. Throws on impossible events (move to a slot outside the array, pop from an
  empty panel, relink to a missing node). Throwing is correct: it is an authoring bug
  and the property tests will catch it.
- `transient` is reset at the start of every step, then filled from this step's
  `compare`/`read`/`skip`.
- `swap` expands to two `move`s. `set` on an empty slot mints `e:<arr>:<i>#<n>` (n =
  a per-run counter) so aux writes have stable identities.
- `pq` panels keep `items` sorted by `(key, id)` after every push; `pop` takes an
  explicit `itemId` so the generator, not the engine, decides priority semantics (the
  generator also computes and yields `mark stale` when applicable).
- No algorithm names anywhere in the reducer.

**Structural sharing:** the reducer copies only the maps it touches (`{...prev, arrays:
{...prev.arrays, a: newA}}`). Typical step touches 1–3 maps.

### Running a trace (`src/engine/run.ts`)

```ts
type Run = { steps: Step[]; states: State[] };   // states[0] = initial, states[k] = after step k-1
function run(gen: Iterable<Step>, initial: State, caps: { maxSteps: number }): Run
```

Runs the generator to completion at load time (inputs are tiny). If `maxSteps` is
hit, the run ends with a final synthetic step noting "step limit reached"; the
input validator makes this unreachable for shipped presets and random inputs.

## 3. Timeline and scrubbing (`src/engine/timeline.ts`)

**Decision: keep every state. No replay.**

Memory math (worst case): 16 elements × ~60 B + arrays + panels ≈ 2–5 KB per state
*if fully copied*; with sharing a typical step allocates < 500 B. Caps: 600 steps
(Dijkstra on 12 nodes / 20 edges ≈ 120 steps; merge sort on 16 ≈ 200; quick sort
worst case 16 all-equal ≈ 300). 600 × 5 KB = 3 MB absolute worst; realistic < 300 KB.
Scrubbing to any k is an array index: O(1), always exact, trivially testable.

Timeline state (React, in `useTimeline`):

```ts
type Timeline = {
  k: number;                 // current step index, 0..steps.length
  playing: boolean;
  speed: 0.5 | 1 | 1.5 | 2;
  scrubbing: boolean;        // true while dragging: renderer uses zero-duration
  gate: number | null;       // step index of the pending ask; play cannot pass it
};
```

Play advances `k` on a timer sized by the step's motion duration ÷ speed. Trace mode
sets `gate` to the next step that has an `ask` (filtered by level) and play pauses
there; after grading, the gate moves to the next ask.

## 4. Scene builder (`src/engine/scene.ts`)

`buildScene(state, layout, viewport) → Scene`. Pure. Returns keyed primitives:

```ts
type Prim =
  | { kind: 'bar';    id: Id; x: number; y: number; w: number; h: number; value: number; mark: MarkKind | null; arr: ArrayName; index: number }
  | { kind: 'caret';  id: `p:${string}`; name: string; x: number; y: number; visible: boolean }
  | { kind: 'region'; id: `r:${string}`; kind2: RegionKind; x: number; y: number; w: number; h: number; visible: boolean }
  | { kind: 'tnode';  id: Id; x: number; y: number; key: number; mark: MarkKind | null }
  | { kind: 'tedge';  id: `te:${Id}`; x1: number; y1: number; x2: number; y2: number }   // child → parent, keyed by child
  | { kind: 'gnode';  id: Id; x: number; y: number; label: string; text: string | null; mark: MarkKind | null }
  | { kind: 'gedge';  id: Id; x1: number; y1: number; x2: number; y2: number; w?: number; mark: string | null }
  | { kind: 'cell';   id: Id; x: number; y: number; value: number | null; deps: Id[]; fresh: boolean }
  | { kind: 'row';    id: Id; panel: string; order: number; label: string; key?: number; stale?: boolean }
  | { kind: 'frame';  id: Id; depth: number; label: string; active: boolean }
  | { kind: 'link';   id: `cmp:${Id}:${Id}`; from: Id; to: Id; style: 'compare' | 'read' | 'dep' };

type Scene = { prims: Map<Id, Prim>; width: number; height: number };
```

**Stable ID strategy:** IDs come from the state, never from array indices. A bar's
`x` is derived from the slot it currently occupies, so when `e:3` moves from slot 3 to
slot 5 the same `<g>` animates from x₃ to x₅. Carets and regions are keyed by name.
Tree edges are keyed by the child node, so a relink animates the line's endpoints.

### Layouts (`src/engine/layout/*`) — computed once per input, never per step

- **Array:** `x = pad + i × cellW`, `cellW = min(56, (viewport − pad) / n)`. Aux
  array rows stack below.
- **Tree (BST):** position by root path, not by in-order rank, so a node's `x` only
  changes if its path changes. `x = cx + Σ_{d=1..depth} (±) span / 2^d`, `y = d × rowH`.
  Depth capped at 5 by input validation (span/2⁵ ≥ 28 px at 900 px wide). On phones
  the SVG uses `viewBox` and scales; a horizontal scroll container is the fallback.
- **Recursion tree (quick/merge sort):** node for segment `[lo, hi]` sits at
  `x = midpoint of the segment's array cells`, `y = depth × rowH`. Aligns visually with
  the array above it, stable by construction.
- **Graph:** nodes ≤ 12. Layered layout: BFS depth from the smallest id gives the
  column, nodes in a column are ordered by id and spread vertically; then one pass of
  barycenter ordering to reduce crossings. Presets may ship hand-placed coordinates.
  Computed once per input; edges are straight lines with labels at the midpoint.
- **Grid:** `cellW = min(44, available / (cols + 1))`.

All layouts return positions in an abstract coordinate space; the renderer maps to
the viewport via `viewBox`, so desktop and mobile share one layout.

## 5. Renderer (`src/render/*`)

React components consume `Scene` and render `<svg viewBox>`. Each primitive is a
`<motion.g>` keyed by its `id`:

```tsx
<motion.g key={p.id}
  initial={enter(p)} animate={{ x: p.x, y: p.y, opacity: 1 }} exit={exitFor(p)}
  transition={motion.for(kindOfChange)} />
```

- **Diffing is React's job**: keys are stable IDs, so entering/leaving primitives are
  handled by `AnimatePresence`, and moving ones by `animate` retargeting the spring.
- **What animates:** position (`x`,`y`), region width, opacity, node radius pulses,
  edge endpoints. **What snaps:** numbers/text, code-line highlight, panel row text,
  colors of marks (a 120 ms fade only).
- **Scrubbing:** while `timeline.scrubbing` or `prefers-reduced-motion`, every
  transition is `{ duration: 0 }`. State is exact, so there is nothing to "catch up".
- **Ghost:** a `Ghost` primitive is injected by the trace layer (not by the state) for
  the duration of the reveal: same shape as the learner's pick, dashed outline, 40 %
  opacity, positioned where their guess would have put it.
- **Linked views:** a `hoverId` React context; every primitive whose `id` or `ref`
  matches gets the `linked` class. Panel rows carry `ref` to the node/element they
  represent, so hovering a PQ row highlights the graph node and the distance-table
  row.
- **Element count budget:** ≤ 200 SVG nodes in a scene. Transforms only; no
  layout-affecting attributes animate.

## 6. Algorithm module anatomy (`src/algorithms/<id>/`)

```ts
interface AlgorithmModule<I> {
  meta: { id: string; title: string; family: 'search' | 'sort' | 'tree' | 'graph' | 'dp';
          renderers: ('array' | 'tree' | 'graph' | 'grid')[]; panels: PanelKind[];
          tieBreak: string; caps: { maxSteps: number; maxSize: number } };
  pseudocode: { lines: string[] };                       // 1-based; later: per-language maps
  invariant: { name: string; sentence: string };         // shown under the lens
  initialState: (input: I) => State;                     // builds arrays/graph/grid
  generate: (input: I, variant?: string) => Iterable<Step>;
  reference: (input: I) => unknown;                      // plain implementation for tests
  invariantCheck: (state: State, input: I) => string | null;   // null = holds
  presets: { id: string; title: string; input: I; why: string }[];
  randomInput: (rng: Rng, target?: string) => I;         // constrained: retries ≤ 50 for target
  validate: (raw: string) => { ok: true; input: I } | { ok: false; error: string };
  encode: (input: I) => string; decode: (s: string) => I | null;   // URL form
}
```

Registry: `src/algorithms/registry.ts` maps id → `() => import('./binary-search')`
plus static metadata for the library page (title, family, estimated minutes).

## 7. Asks (checkpoints) and grading (`src/trace/*`)

Asks are declared by the generator on the step they precede. This guarantees the
correct answer is computed by the algorithm itself.

```ts
type Ask =
  | { kind: 'pick';  prompt: string; level: 'guided' | 'full'; answer: Id;
      candidates: Id[];                                  // clickable set (defaults: all elements/nodes)
      distractors: Distractor<Id>[] }
  | { kind: 'value'; prompt: string; level; answer: number; distractors: Distractor<number>[] }
  | { kind: 'order'; prompt: string; level; answer: Id[]; pool: Id[]; distractors: Distractor<Id[]>[] }
  | { kind: 'choice'; prompt: string; level; answer: string; options: string[]; distractors: Distractor<string>[] };
      // 'choice' covers "which delete case?", "does the loop end?" — cheap and useful.

type Distractor<A> = { answer: A; kind: MistakeKind; rule: string };
type MistakeKind =
  | 'boundary'         // off-by-one, lo<=hi vs lo<hi, wrong mid
  | 'comparison'       // direction of the comparison
  | 'order'            // wrong structure order (queue vs stack, PQ pop order)
  | 'stale'            // acted on a stale PQ entry
  | 'base-case'        // missed base case / termination
  | 'subtree'          // wrong side of the tree
  | 'shift-vs-swap'    // insertion sort mechanics
  | 'dependency'       // DP cell read wrong neighbours
  | 'unclassified';
```

Level filter: Guided shows asks with `level === 'guided'`; Full shows all.
`grade(ask, given) → { correct: boolean; kind: MistakeKind | null; rule: string | null }`
- `pick`, `value`, `choice`: equality. `order`: exact sequence equality; the prompt
  says "in pop order".
- Wrong answer: first distractor with equal `answer` wins; otherwise `unclassified`
  with the ask's general rule (the invariant sentence).

Trace scoring: `score = correct / asked` per session; per-ask records
`{ algorithm, askIndex, kind, correct, mistakeKind, seed, at }`.

Tests per algorithm: every ask on every preset and on 200 random inputs has
`answer` in `candidates`/`pool` or `options`, no distractor equals the answer, and
the answer equals what the *next step's events* actually do (derived checker per
ask kind, e.g. for `pick` the next step must touch `answer`).

## 8. Mistake bank and review scheduler (`src/learn/*`)

```ts
type MistakeRecord = { id: string; algorithm: string; kind: MistakeKind; rule: string;
                       seed: string; askIndex: number; at: number };
type ReviewItem = { algorithm: string; box: 0 | 1 | 2 | 3 | 4; due: number; reviews: number; lastScore: number };
```

Leitner intervals by box: `[1, 3, 7, 21, 60]` days. After a trace session on an
algorithm: score ≥ 0.8 → box + 1 (max 4); else → box 0. `due = now + interval[box]`.
Review seed: `hash(algorithm, reviews)` so it is fresh and reproducible.
"Welcome back — N re-traces due, ~M minutes": M = Σ per-algorithm estimated minutes.

## 9. Persistence (`src/lib/storage.ts`)

`localStorage` key `dryrun.v1`, one JSON document:

```ts
type Store = { version: 1; settings: { theme: 'system' | 'light' | 'dark'; motion: 'system' | 'reduced'; level: 'guided' | 'full' };
               sessions: SessionRecord[]; mistakes: MistakeRecord[]; review: Record<string, ReviewItem> };
```

Migrations: `migrate(raw: unknown): Store` runs `v1 → v2 → …` steps; unknown/corrupt
data → fresh store with a one-time notice. Writes are debounced (250 ms). Export =
download the JSON; import = validate with a hand-written guard then replace.
Quota exceeded → keep the newest 500 sessions.

## 10. URL state (`src/lib/url.ts`)

```
/t/binary-search?i=3,7,9,12,15&x=42&v=classic&seed=k9d2&mode=trace&level=guided
/t/bst?i=8,3,10,1,6&op=delete&x=3
/t/dijkstra?g=0-1:4,0-2:1,2-1:2&s=0
/r  (review session)   /m (mistakes)   /p (progress)   /s (settings)
```

- Input encoding is per module (`encode`/`decode`); everything is validated on load.
  Invalid → the algorithm's default preset with a notice.
- Opening a link never auto-plays: the trace loads at step 0, paused.
- `seed` absent → derived from the input string, so the same input always gives the
  same ask set.

## 11. Phase 2 plug-in points (design only)

**Event source interface** is the seam:

```ts
interface EventSource<I> { steps(input: I): Promise<Step[]> }   // authored: sync wrapper
```

"Your code" for JS:
- User code (a function with a fixed signature per algorithm) is parsed with Acorn,
  and an instrumentation pass inserts `__emit(...)` calls: array reads/writes on the
  named input arrays → `read`/`set`/`swap` events; declared pointer variables → `pointer`;
  loop headers → `line`. The result is a `Step[]` in the same format, so reducer,
  scene, renderer and timeline are unchanged. Asks are not declared by user code; the
  reference module's asks are aligned by step tag during divergence replay.
- Runs in a `Worker` inside a sandboxed `<iframe sandbox="allow-scripts">` (no
  `allow-same-origin`, so no access to our origin's storage), served from a separate
  path with a strict CSP. Step budget (e.g. 5,000 emits) and a hard timeout
  (`worker.terminate()` after 2 s).
- Threats: malicious shared links carrying code → code never runs without an explicit
  "Run my code" click and a visible source panel; code is stored only in the URL
  fragment or local storage, never sent anywhere; the sandbox prevents DOM/storage
  access; infinite loops are bounded by the budget and timeout; memory bombs are
  bounded by the emit budget (each emit is small) and the Worker being killed.
- Divergence replay: two `Run`s, side-by-side renderers, auto-pause at the first `k`
  where `stateEquals(a.states[k], b.states[k])` is false.
- AI explain: one Cloudflare Worker + D1 cache keyed by `hash(algorithm, divergence
  signature)`; Groq free tier; BYO key header; deterministic fallback = the distractor
  rule text.
- Python: Pyodide in a Worker with `sys.settrace` mapping line events and local
  variable snapshots to the same events. Heavier (~10 MB), lazy-loaded on demand only.

## 12. Testing strategy

- `engine/*.test.ts`: reducer unit tests per event; determinism (forward == index ==
  backward); scene stability (same state → same prims).
- `algorithms/<id>/*.test.ts`: fast-check with 1,000 runs — final state equals
  `reference(input)`; `invariantCheck` returns null at every step; step count under
  cap; ask tests (§7); presets round-trip through `encode`/`decode`.
- `trace/*.test.ts`: grading, classification, scoring.
- `learn/*.test.ts`: scheduler math, seeds, migrations.
- `e2e/`: Playwright — landing hero loop, one full trace on mobile and desktop, light
  and dark, reduced motion; screenshots reviewed by a human before "done".
