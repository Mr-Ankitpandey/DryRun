# DryRun — project guide for Claude sessions

DryRun is a dry-run / tracing trainer for Data Structures & Algorithms. The learner
*performs* the algorithm: predict the next state → reveal the truth → see the gap
(ghost + one-line rule) → re-trace later on a fresh seeded input.
Positioning: "Stop watching algorithms. Start tracing them."

Owner: solo developer, zero budget, ship early. Read `docs/PLAN.md` first.

## Hard rules (from the owner — never break these)

1. All work happens inside this root folder. No write of any kind may go outside it.
2. No AI message, note or trace is written outside this folder (no global memory,
   no artifacts, no online docs, no scratch files elsewhere).
3. Do not touch any other project or process running on this machine. If a port is
   busy, pick another port; never kill what is using it.
4. Do not leak any chat message or prompt anywhere outside this project.
5. Do not touch or change any configuration outside this project. Do not change
   any git setting (no `git config`, global or user level).

Practical consequences:
- Package caches point inside the project: `npm --cache ./.cache/npm ...`.
  Playwright browsers install to `./.cache/ms-playwright` via `PLAYWRIGHT_BROWSERS_PATH`.
- Temporary files go in `./.scratch/` (git-ignored), not `/tmp`.
- Never run `git init`, commit, push or deploy unless the owner asked in this session.

## Working agreement

- Challenge the owner when something is wrong, risky or over-scoped. Say why.
- Simplest design that meets the quality bar. No speculative abstractions beyond
  the Phase 2 plug-in points listed in `docs/ARCHITECTURE.md`.
- Never claim something works without running it: run `npm test`, run the dev
  server, check the UI at mobile and desktop widths, light and dark, reduced motion.
- Check official docs for library APIs and free-tier limits; do not guess.
- Small increments: one focused change, tests green, then commit (when allowed).
- Keep `CLAUDE.md` and `docs/` updated as decisions change; record decisions with a
  short rationale in `docs/PLAN.md` → "Decision log".
- End every work session with: what was done, what is next, open questions.

## Tech stack (pinned; verified 2026-09-25 against the npm registry)

Node 20.20.2 / npm 10.8.2 on the dev machine (do not upgrade Node without asking).

| Package | Version | Why |
|---|---|---|
| react, react-dom | 19.3.0 | UI |
| vite | 8.3.1 | build/dev (needs Node ^20.19) |
| @vitejs/plugin-react | 6.1.1 | JSX + fast refresh |
| typescript | 5.9.3 | strict mode. NOT 7.x: typescript-eslint supports `<6.1` |
| tailwindcss + @tailwindcss/vite | 4.3.3 | utilities; tokens live in CSS `@theme` |
| motion | 13.4.3 | animation, import from `motion/react` |
| wouter | 3.11.0 | routing, ~2 KB |
| vitest | 4.1.11 | tests. NOT 5.x: needs Node 22 |
| fast-check | 4.10.2 | property tests |
| @playwright/test | 1.63.0 | browser visual QA (dev only) |
| eslint + typescript-eslint | 10.11.0 / 8.70.1 | lint |

Rendering is SVG. No d3, no dagre: all layouts are computed in-project (see
`docs/ARCHITECTURE.md` → Layouts). Hosting: static `dist/` on any free static host.
No backend in the MVP.

## Architecture contract (do not violate)

```
Event source (authored generator; later: instrumented user code)
   → Step[]          { line, events[], note, ask? }
   → reducer         state[k] = apply(state[k-1], step[k].events)   (pure, exact)
   → scene builder   state → keyed primitives with stable IDs
   → SVG renderer    diffs scene[k-1]→scene[k] by ID, animates only changes
   ↑ timeline        stepIndex, play/pause/scrub/speed, checkpoint gating
   ↑ trace layer     asks, grading, mistake classification, review scheduling
```

- Semantic events are the contract. Animation is derived, never hand-authored
  per algorithm.
- Adding an algorithm = one folder under `src/algorithms/<id>/` (generator,
  pseudocode + line map, invariant, asks, presets, input generator, tests).
  Engine changes for a new algorithm are a design bug.
- Every element has a stable ID and moves; it never vanishes and reappears.
- State at step k is exact. Scrubbing backward is never an approximate undo.
- All randomness goes through the seeded RNG; the seed lives in the URL.
- Correctness > everything. A wrong animation destroys trust.

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess` on. No `any`. No default exports
  except route pages.
- Files: `kebab-case.ts`, components `PascalCase.tsx`, one component per file.
- Engine (`src/engine`) has no React imports. Algorithms (`src/algorithms`) have
  no React and no DOM imports. Tests live next to code as `*.test.ts`.
- Colors and motion only via tokens (`src/styles/tokens.css`, `src/ui/motion.ts`).
  Never hard-code a hex or a duration in a component.
- Every semantic state has a color AND a non-color cue.
- Copy: sentence case, plain verbs, no emoji in UI.

## UI Design Rules

When building or modifying frontend UI:

- Do not blindly use common AI-generated UI patterns.
- Do not default to purple/blue gradients, Inter/Roboto, excessive rounded cards,
  glassmorphism, generic hero sections, or arbitrary decorative elements.
- Establish a clear visual direction based on the product, target users,
  brand, content and information hierarchy.
- Every major visual decision should have a reason.
- Prefer a coherent design system over adding random visual effects.
- Do not change existing branding or design-system decisions without a reason.
- Before considering UI work complete, critically review whether the result
  looks generic or template-like.
- Prioritize usability and consistency over novelty.

The chosen direction and tokens are in `docs/DESIGN.md`. Follow them.

## Commands

```
npm install --cache ./.cache/npm     # install (cache stays inside project)
npm run dev                          # Vite dev server (pick a free port if 5173 busy)
npm test                             # vitest run (unit + property tests)
npm run test:watch
npm run typecheck                    # tsc --noEmit
npm run lint
npm run build && npm run preview     # production build, local preview
npm run e2e                          # Playwright visual QA (after browsers installed)
```

## What NOT to build (out of scope, do not suggest)

Auth/accounts, any backend for the MVP, Express/MongoDB, AI chatbot, AI-generated
visualizations or problems, leaderboards/XP/badges/streak guilt, social features,
3D/WebGL, native mobile app, C++/Java execution, microservices, bubble/selection
sort as headline content, force-directed layouts, confetti.

Phase 2 (design for, do not build yet): "Your code" mode for JS (AST instrumentation
in a sandboxed Worker), "Break my code", divergence replay, AI explain proxy
(one Cloudflare Worker + D1, Groq free tier, BYO key), Python via Pyodide.
