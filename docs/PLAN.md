# DryRun — plan

Status: draft for owner review. Nothing below is built yet.
Last updated: 2026-09-25.

## 1. The product in one paragraph

Interview-prep students already know what binary search or Dijkstra *is*. What they
cannot do is run it in their head reliably, which is why they cannot write it and why
they forget it in weeks. DryRun puts the algorithm on screen, stops at the moments
that matter and asks "what happens next?". The learner commits (click an element,
order a queue, type a value), the real move plays, and if they were wrong their guess
stays on screen as a ghost next to the truth with the one rule they broke. Mistakes
are stored by kind, and the algorithm comes back days later on a fresh input the
learner has never seen. Watching is only the fallback.

## 2. Decisions made (owner said "ship early", so these are decided, not asked)

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Code languages | Pseudocode only at launch. JS/Python/C++/Java line maps after the 8 algorithms are locked. | 40 authored listings with line maps is the single biggest authoring cost and every mismatch is a trust bug. |
| 2 | Blind mode | Not at launch. Guided + Full only. Blind is the first post-launch feature. | Guided/Full already hide the next move. Blind needs its own "state after N hidden steps" question UI. |
| 3 | LCS vs knapsack | 0/1 knapsack | Root DP problem for the placement audience; its classic bug (reading the current row → unbounded knapsack) is exactly a mental-model error DryRun catches. Capacity ≤ 10 so the grid fits a phone. |
| 4 | BST delete, two children | Copy the in-order successor's key into the node, then delete the successor node (which has at most a right child). | What students actually write and what GfG/most courses teach. Animation is a value copy plus a small relink. |
| 5 | Ties | Every algorithm states a visible tie-break rule (smaller index / smaller node id first). PQ "order" questions ask for pop order, never heap-array layout. Set-valued answers are graded as sets. | Guarantees exactly one correct answer, which is a test requirement. |
| 6 | Mistake classification | Each ask carries generator-computed distractors: `{answer, kind, rule}`. A wrong answer that matches a distractor gets that kind; otherwise "unclassified". | Deterministic, testable, computed from the actual state (not hand-tagged per input), and much cheaper than running buggy variants. Buggy-variant probes stay a Phase 2 idea. |
| 7 | Scrubbing | Precompute all steps and keep every state (structural sharing). No replay-from-checkpoint. | State ≤ ~5 KB, steps ≤ 600 → < 3 MB worst case. Exact, simplest, O(1) scrub. Math in ARCHITECTURE. |
| 8 | Persistence | `localStorage` JSON with a schema version + migrations, plus JSON export/import in Settings. No IndexedDB. | Data is < 200 KB for a heavy user. Export/import covers "cleared browser / new phone". |
| 9 | Layout libs | None. Trees, recursion trees, graphs and grids are laid out in-project (< 150 lines total). | Inputs are tiny (≤ 16 items, ≤ 15 nodes, ≤ 12 graph nodes). Stability across steps matters more than generality. |
| 10 | Routing | wouter | 2 KB, hash-free URLs, enough for 7 routes. |
| 11 | Hosting | Static `dist/`, host-agnostic. First deploy target: Cloudflare Pages (free: 500 builds/mo, 1 concurrent). Vercel / Netlify / Render / GitHub Pages work unchanged. | Owner asked for free platforms. Note: Vercel Hobby terms are non-commercial; owner's call at deploy time. No deploy is done by Claude. |
| 12 | Analytics / feedback | Cloudflare Web Analytics (free, cookieless) or none; feedback via a free form (Tally/Google Form) plus an in-app "Copy my session summary" button. | No backend, nothing to maintain. |
| 13 | Node | Stay on Node 20.20.2. Vitest pinned to 4.x, TypeScript to 5.9.x. | Upgrading Node touches the machine (hard rule 5). |
| 14 | Sound | None. | Not in scope. |
| 15 | Git | Not initialised until the owner says so. Owner decides whether commits carry a Co-Authored-By line. | Hard rules 2 and 5. |

## 3. Scope tiers

### Launch (v0.1 → v1.0)

- Engine: events, reducer, scene builder, SVG renderer (array, tree, graph, grid),
  panels (stack, queue, PQ, call stack, variables), exact timeline scrubbing.
- Watch mode: play/pause/step/scrub/speed, synced pseudocode highlight.
- Trace mode: `pick`, `value`, `order` asks; Guided + Full levels; scoring.
- 8 algorithms: binary search (+ lower bound), insertion sort, quick sort, merge sort,
  BST insert/search/delete, BFS, Dijkstra (lazy deletion), 0/1 knapsack.
- Mistake bank by kind; spaced review (Leitner 1/3/7/21 days) on fresh seeded inputs.
- Custom input with validation + edge-case presets; shareable URLs (algorithm, input,
  seed; never auto-run).
- Landing with live-trace hero; library; progress (one honest chart); settings
  (theme, motion, export/import, reset).
- Keyboard-first, `aria-live` narration, reduced motion, light + dark.

### After launch (in this order)

1. Blind mode.
2. JS / Python / C++ / Java code display with line maps.
3. Review sessions that target the learner's weakest mistake kind.
4. More algorithms (DFS, topological sort, heap ops, union-find, LCS).

### Phase 2 (designed for now, not built)

"Your code" JS mode, "Break my code", divergence replay, AI explain proxy, Python.

## 4. Milestones (ordered by risk, each ends with something runnable)

Estimates are working sessions, not calendar days. "Done" means tests green and
the UI checked in a browser at 390 px and 1280 px, light and dark, reduced motion.

### M0 — Scaffold (1 session)

- Vite + React + TS strict + Tailwind 4 + Motion + Vitest + ESLint + Playwright config.
- Tokens file, theme switch (light/dark/system), reduced-motion hook, seeded RNG,
  URL codec, storage module with versioning. All unit-tested.
- Accept: `npm run typecheck && npm test && npm run build` green; blank app renders
  in both themes.

### M1 — Engine spike on the three hardest cases (3–4 sessions)

Quick sort (recursion + array), Dijkstra (graph + PQ with stale entries), BST delete
(tree restructuring). Bare visuals: rectangles, circles, lines, no styling.
- Event schema, reducer, scene builder, renderer diffing, timeline all real.
- Accept:
  - Property tests: 1,000 random inputs per algorithm, final state equals reference
    implementation; invariants hold at every step.
  - Determinism tests: state[k] via forward play == replay == scrubbing back from end.
  - Object constancy: an element's ID is the same before and after any swap/relink.
  - No algorithm-specific branch exists in `src/engine`. If one is needed, redesign
    the schema before M2.
  - Scrubbing 0→end→0 on a 400-step trace stays under 16 ms per step in the profiler.

### M2 — Design system + style tile (1–2 sessions)

- `/styleguide` route: tokens, type scale, the semantic vocabulary (color + shape),
  every motion primitive with a "play" button, the array/tree/graph/grid renderers
  with sample data, buttons/inputs/panels, both themes.
- Accept: owner approves look and motion in the browser before any screen is built.

### M3 — Validation prototype → first public deploy (3 sessions)

- Binary search: Watch + Trace (Guided/Full), asks, ghost, invariant lens, timeline
  ticks, keyboard control, mobile layout.
- Landing page with the live hero ("Binary search for 42 — where does mid go next?").
- "Copy my session summary" button; feedback form link.
- Accept: a student can finish a binary-search trace on a phone with no help; owner
  shows it to 15–20 students; Lighthouse ≥ 90 on landing.
- **Ship v0.1 here.**

### M4 — Remaining algorithms (4–5 sessions, ship after each pair)

Insertion sort + BFS (quick wins), then quick sort + merge sort, BST, Dijkstra,
knapsack. Each is fully authored: asks, distractors, invariants, presets, tests.
- Accept per algorithm: property tests, ask tests (exactly one correct answer, grading
  correct, every distractor is wrong), invariants, presets load from URL.

### M5 — Learning layer (2–3 sessions)

Mistake bank, Leitner review queue, "Welcome back — 3 re-traces due, ~4 minutes",
progress chart, export/import.
- Accept: scheduler unit tests (interval math, demotion, fresh seeds); a review
  session runs end to end from the landing page in one click.

### M6 — Polish and launch (2 sessions)

Accessibility pass (keyboard, aria-live, focus), 60 fps check on Android, Lighthouse
≥ 90 all categories, share URLs, 404 page, README, `v1.0`.

## 5. Dependency list (verified 2026-09-25)

Runtime (ships to the browser):

| Package | Version | Job | Approx. gzipped size | Why not hand-write it |
|---|---|---|---|---|
| react + react-dom | 19.3.0 | UI | ~45 KB | Required by brief. |
| motion | 13.4.3 | Spring animation of SVG transforms, enter/exit via `AnimatePresence`, `useReducedMotion` | ~35 KB (tree-shaken `motion/react`) | Interruptible springs that retarget mid-flight are >50 lines and easy to get wrong; scrubbing depends on them. |
| wouter | 3.11.0 | Routing | ~2 KB | Could be hand-written, but 2 KB buys correct history handling and link components. |
| @fontsource-variable/* | 5.3.0 | Self-hosted fonts (no Google Fonts request) | ~30–60 KB per family, cached | Fonts must be self-hosted for offline-safe, privacy-clean loading. Exact families chosen in DESIGN.md. |

Dev only: vite 8.3.1, @vitejs/plugin-react 6.1.1, typescript 5.9.3, tailwindcss +
@tailwindcss/vite 4.3.3, vitest 4.1.11, fast-check 4.10.2, @playwright/test 1.63.0,
eslint 10.11.0, typescript-eslint 8.70.1, eslint-plugin-react-hooks, @types/react.

Rejected: d3-hierarchy/d3-* (layouts are trivial at our sizes), dagre (same),
zustand/redux (engine state is a plain array of immutable states; UI state is small
React state), immer (structural sharing is done by hand in a 100-line reducer),
react-router (heavier than needed), wrangler (needs Node 22; not needed for static
Pages via Git integration).

Budgets: landing route ≤ 120 KB gzipped JS total; each algorithm module ≤ 15 KB and
lazy-loaded; fonts ≤ 120 KB total; LCP < 2.5 s on simulated 4G; Lighthouse ≥ 90.

## 6. Repository structure

```
AlgoVisuals/
  CLAUDE.md
  docs/                    PLAN, ARCHITECTURE, DESIGN, ALGORITHMS
  index.html
  package.json, vite.config.ts, tsconfig.json, eslint.config.js, playwright.config.ts
  public/                  favicon, og image, robots
  src/
    main.tsx               app bootstrap, router
    app/                   route pages (default exports): Landing, Library, Trace,
                           Review, Mistakes, Progress, Settings, Styleguide, NotFound
    engine/                NO React. events.ts, state.ts, reducer.ts, scene.ts,
                           timeline.ts, ids.ts, layout/{array,tree,graph,grid}.ts
    trace/                 asks.ts (types), grade.ts, mistakes.ts, scoring.ts
    learn/                 review scheduler, progress aggregation
    algorithms/
      registry.ts          id → lazy import + metadata
      types.ts             AlgorithmModule interface
      binary-search/       generator.ts, pseudocode.ts, presets.ts, input.ts,
                           meta.ts, index.ts, *.test.ts, reference.ts
      insertion-sort/ … knapsack/
    render/                React SVG renderers: ArrayView, TreeView, GraphView,
                           GridView, panels/, primitives/ (Bar, Node, Edge, Caret,
                           Region, Ghost), Timeline, CodeView, Narration
    ui/                    design-system components + motion.ts + hooks
    lib/                   rng.ts, url.ts, storage.ts, format.ts
    styles/                tokens.css, base.css
  e2e/                     Playwright visual checks
  .cache/                  npm + playwright caches (git-ignored)
  .scratch/                temp files (git-ignored)
```

## 7. Risks and how the plan handles them

- **Schema can't express a hard case** → M1 tries the three hardest first with throwaway
  visuals. Redesign there is cheap; after M3 it is not.
- **Animation correctness on scrub** → every state is precomputed and exact; the
  renderer only ever animates from what is on screen to state[k]. No tweened
  intermediate states are ever the source of truth.
- **Authoring cost per algorithm** → the module template and test harness are
  built once in M1 and reused; each algorithm is a copy-and-fill.
- **"Wow" not landing** → M2 style tile is judged in the browser before screens exist.
- **Mobile performance** → SVG element count stays under ~200 per scene; transforms
  only (no layout-affecting props); springs disabled while scrubbing.

## 8. Parallel work plan (multiple agents)

The owner wants several agents building in parallel. Parallel work only pays off
after the contract is frozen; before that, agents would each invent their own
schema. So: one sequential "spine" package, then waves of disjoint packages.

### Rules for every agent

- Every agent prompt includes the five hard rules and the `CLAUDE.md` link. Agents
  work in this folder only, use `./.scratch/` for temp files and `./.cache/npm`.
- **File ownership is exclusive.** A package lists the paths it may create or edit.
  Anything else is read-only. Shared files (`package.json`, `src/main.tsx`, the
  router, `src/algorithms/registry.ts`, `docs/*`, `CLAUDE.md`) are edited only by
  the lead (this session).
- **Interfaces are frozen at the end of WP-0.** If a package needs an interface
  change, the agent stops, writes the proposed change and reason in its report, and
  does not work around it. The lead updates ARCHITECTURE and re-dispatches.
- Every package ends with: `npm run typecheck && npm test && npm run lint` green for
  the whole repo, a report listing files changed, tests added, commands run with
  output, and open questions. No "it should work".
- UI packages also end with Playwright screenshots at 390 px and 1280 px, light and
  dark, saved under `./.scratch/shots/<package>/` for the lead to review.
- Without git there are no worktrees or merges: exclusive paths are the only
  protection. **Recommendation: allow `git init` before wave 1** so each package
  can be a commit and a bad package can be reverted.

### Packages

**WP-0 Spine (sequential, lead or one agent, ≈ 2 sessions)** — M0 + the engine core.
Owns: scaffold, `src/styles/tokens.css` (from DESIGN §1, tokens only),
`src/lib/{rng,url,storage,format}.ts`, `src/engine/{events,state,reducer,run,timeline,ids}.ts`,
`src/algorithms/types.ts`, the test harness `src/algorithms/_harness/` (property,
determinism, ask-consistency helpers), `src/algorithms/binary-search/` (generator,
tests only, as the reference module). Exit: everything in ARCHITECTURE §1–3, §6–7
types exists and is tested; harness runs on binary search.

**Wave 1 (4 agents in parallel, ≈ 2 sessions)**

| Package | Owns | Depends on | Acceptance |
|---|---|---|---|
| WP-A Scene + renderers | `src/engine/scene.ts`, `src/engine/layout/*`, `src/render/**` (except `Timeline`, `asks/`) | WP-0 | Scene builder pure + tested; bare SVG views for array/tree/graph/grid + panels driven by `Run` from the harness fixtures; object constancy demo (swap, relink) verified in the browser; ≤ 200 SVG nodes. |
| WP-B Design system | `src/ui/**`, `src/styles/base.css`, `src/app/Styleguide.tsx` | WP-0 tokens | Styleguide route shows tokens, type scale, vocabulary (color + shape), motion playground, all components, both themes; contrast script passes; reduced motion honoured. |
| WP-C Algorithms batch 1 | `src/algorithms/{quick-sort,dijkstra,bst}/` | WP-0 | ALGORITHMS §3, §5, §7 fully: generator, asks + distractors, presets, random input with targets, reference, invariant, 1,000-run property tests, ask tests, step caps. No engine edits (report if needed). |
| WP-D Trace + learn | `src/trace/**`, `src/learn/**`, storage schema in `src/lib/storage.ts` (coordinated) | WP-0 | Grading, classification, scoring, Leitner scheduler, migrations, export/import; all unit-tested with fixed seeds. |

Lead integration checkpoint after wave 1 = **Milestone 1 (engine spike)**: run the
three WP-C modules through WP-A's renderers; determinism and scrub tests on real
traces; decide whether the schema survives. Only then wave 2.

**Wave 2 (4 agents in parallel, ≈ 2–3 sessions)**

| Package | Owns | Depends on | Acceptance |
|---|---|---|---|
| WP-E Trace screen | `src/app/Trace.tsx`, `src/render/Timeline.tsx`, `src/render/Transport.tsx`, `src/render/asks/**`, `src/render/Ghost.tsx`, keyboard hook | A, B, D | Binary search + the batch-1 modules traceable end to end; ghost, invariant lens, timeline ticks and mistake marks, keyboard map, mobile layout; e2e test for one full trace. |
| WP-F Landing + library | `src/app/{Landing,Library,NotFound}.tsx` | A, B | Live hero loop per DESIGN §6.1; library table; Lighthouse ≥ 90 on landing (measured, output in report). |
| WP-G Algorithms batch 2 | `src/algorithms/{insertion-sort,merge-sort,bfs,knapsack}/` | WP-0 | Same bar as WP-C. |
| WP-H Learning screens | `src/app/{Review,Mistakes,Progress,Settings}.tsx` | B, D | Review session flow, mistake bank, one honest chart (dataviz rules), settings incl. export/import and "copy session summary". |

**Wave 3 (2 agents, ≈ 1–2 sessions)** — WP-I accessibility + e2e sweep (keyboard,
aria-live, focus, reduced motion, screenshots all screens); WP-J performance
(bundle budgets, lazy loading, 60 fps profile, Lighthouse all routes). Lead does
the final review, README and release.

### How the lead runs this

1. Hand over: one prompt per package containing the hard rules, the package row
   above, the exact doc sections to follow, the frozen interfaces (file paths), and
   the report format. Agents run in the background; the lead does not duplicate
   their work.
2. Sync: when an agent reports an interface problem, the lead resolves it in
   `docs/ARCHITECTURE.md` first, then messages the affected agents.
3. Evaluate each report against its acceptance row: run the commands, read the
   diff for the owned paths, check nothing outside the owned paths changed, check
   the screenshots, and re-dispatch with a precise fix list if anything fails.
   Nothing is "done" on an agent's word.
4. Record outcomes in the decision log and update `docs/` when a package changed a
   decision.

## Decision log

- 2026-09-25 — Plan drafted. See table in §2.
