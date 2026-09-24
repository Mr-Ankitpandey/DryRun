# DryRun — design

Status: draft for owner review. Last updated: 2026-09-25.
The owner's UI rules in `CLAUDE.md` apply to everything here.

## 0. What the design is grounded in

The subject is *dry-running code by hand*: the thing students do on paper with a pen
before an interview, and the thing a debugger does for you. The audience is
placement-prep students on mid-range Android phones, often in daylight, often on
the bus. The primary job of every screen is: show the exact state, ask one clear
question, make the gap between their prediction and the truth unmistakable.

So the design language should feel like a **precision instrument for tracing**, not a
dashboard and not a science-fair animation. The memorable thing is the trace itself:
the ghost of a wrong guess next to the real move. Everything else stays quiet.

## 1. Three directions

### A. Graph paper (recommended)

Mood: an engineering notebook. Light-first. A faint graph-paper grid is the working
surface; array cells, tree nodes and grid cells sit *on* the grid lines, so state
looks written down, not floating. Ink is deep navy, not black. The learner's wrong
guess is a red-pencil sketch; the truth is drawn in pen.

Tokens (light "paper" / dark "blackboard"):

| token | light | dark | use |
|---|---|---|---|
| `--bg` | `#F6F7F4` | `#111820` | page |
| `--grid` | `#DDE3E7` | `#1D2833` | graph-paper lines (20 px minor, stronger line every 100 px) |
| `--surface` | `#FFFFFF` | `#182231` | panels, ask sheet |
| `--ink` | `#13233A` | `#E6ECF2` | text, settled fills, pointers |
| `--ink-2` | `#5A6A7B` | `#93A2B3` | secondary text, unvisited outlines |
| `--rule` | `#B9C5CF` | `#31404F` | dividers, ticks |
| `--pen` | `#1E4ED8` | `#7DA2FF` | accent: write/move, primary button, active line |
| `--amber` | `#B76A00` | `#F0A73B` | compare |
| `--teal` | `#0D8577` | `#3BC4B2` | frontier |
| `--red` | `#CF3A3A` | `#FF6E6E` | ghost / error |
| `--green` | `#1F8A4C` | `#4FC98A` | correct |
| `--hatch` | `#E9EFF7` | `#1F2C3C` | invariant region base |

Typography: display **Bricolage Grotesque** (700, tight tracking, used only for the
landing headline, screen titles and the big "Welcome back" line); UI **Instrument
Sans** (400/500/600); mono **JetBrains Mono** (values, code, keys, timeline step
numbers). Type scale (1.25 ratio, 16 px base): 12 · 14 · 16 · 20 · 25 · 31 · 39 · 49.
Line length ≤ 70 ch. Sentence case everywhere.

Motion personality: *pen on paper*. Precise and quick, near-critically damped, no
overshoot on data; a hint of overshoot only on the ask sheet and the correct tick.
Regions extend like a ruler being drawn (width animates from the anchor). Ghosts
appear by "sketching in" (dash offset 240 ms), never by fading.

Trace screen wireframe (desktop ≥ 1024 px, left aligned, 12-col grid):

```
┌────────────────────────────────────────────────────────────────────────┐
│ DryRun   Binary search · classic · guided ▾            step 7 / 23   ? │
├──────────────────────────────────────────────┬─────────────────────────┤
│ The target, if present, is inside [lo, hi].  │ pseudocode              │
│                                              │  1  lo = 0, hi = n-1    │
│   ┌───┬───┬───┬───┬───┬───┬───┬───┬───┐      │  2  while lo <= hi:     │
│   │ 3 │ 7 │ 9 │12 │15 │21 │30 │42 │51 │      │ ▶3    mid = lo+(hi-lo)/2│
│   └───┴───┴───┴───┴───┴───┴───┴───┴───┘      │  4    if a[mid]==x …    │
│   ▲lo              ▲mid              ▲hi     │                         │
│   ░░░░ eliminated ░░░░                       │ variables               │
│                                              │  lo 0   hi 8   mid 4    │
│ mid is 4: 15 < 42, so everything up to mid   │  x 42                   │
│ is out.                                      │ ─────────────────────── │
│ ┌──────────────────────────────────────────┐ │ this run                │
│ │ Where does lo move next?  click a cell   │ │  6 asked · 5 right      │
│ │ (or press 1–9)                            │ │  1 boundary mistake     │
│ └──────────────────────────────────────────┘ │                         │
├──────────────────────────────────────────────┴─────────────────────────┤
│ ◀  ▶  ⏵    ┼──┼──┼──●──┼──✕──┼──┼──┼──┼──┼──┼──┼──┼──┼    1× ▾        │
└────────────────────────────────────────────────────────────────────────┘
```

Mobile (≤ 640 px): header → sticky viz (min 220 px, `viewBox` scaled) → narration
line → ask sheet pinned at the bottom in thumb reach → timeline as a 32 px strip
directly above the sheet. Pseudocode and variables live in a "Code" tab reached by
a segmented control under the viz. Nothing scrolls horizontally except a wide BST.

### B. Bench instrument

Mood: a logic analyser on a lab bench. Dark-first. Blue-black graphite surfaces with
visible bevelled panel edges, amber and cyan "channels" for the two things being
compared, a persistent horizontal "trace" strip that doubles as the timeline (each
step is a sample on a scope). Very dense, very exact.

Tokens: bg `#0F1419` / light `#EEF1F4`; panel `#171E26`; amber `#F5B94A`; cyan
`#4FD1E0`; hot `#FF5A5A` (ghost); ok `#7CE0A2`; text `#D9E1EA`; dim `#7A8794`.
Typography: display + UI **Space Grotesk**, mono **IBM Plex Mono** (data, everywhere
numbers appear). Motion: snappy, mechanical, 120–200 ms, linear-out easings, no
springs; step changes "click" (a 1-frame flash of the changed cell's outline).
Trace screen: viz on a black "screen" area with a thin scanline grid; code in a
right rail; the timeline is a full-width waveform under the screen where mistakes
are red spikes.
Why not: dark instrument UIs are already the default of every visualizer and of
"dark SaaS"; daylight legibility on cheap phones is worse; the dense look competes
with the ask.

### C. Studio debugger

Mood: a debugger built by a game studio: chunky, tactile, playful in the controls and
strict in the data. Deep slate base, warm off-white panels, one saturated accent
(coral `#FF6A4D`), 2 px ink outlines and hard 3 px offset shadows on interactive
controls only. Big rounded rectangles for cells (radius 10), springy motion with
visible overshoot, satisfying press states.
Tokens: bg `#1B2230` / light `#F4F2EC`; panel `#F9F8F4`; ink `#1B2230`; coral
`#FF6A4D`; violet `#6E5AE6` (compare); ok `#26B36B`; ghost `#FF3B3B`.
Typography: display **Bricolage Grotesque** 800, UI **Instrument Sans**, mono
**Geist Mono**. Motion: springs with 8–12 % overshoot (stiffness 380, damping 22),
button presses scale 0.97 with a hard shadow collapse.
Why not: the tactile/overshoot personality is fun but fights the "calm, exact"
requirement; hard-shadow "neo-brutalist" styling is now a recognisable template;
overshoot on data elements makes precise reading harder on small screens.

### Recommendation: A, Graph paper

- It is *about* the subject: dry-running is pen and paper; the ghost is literally a
  pencil sketch next to the pen line. Nobody in this category looks like this.
- Light-first fits the audience's phones and daylight; the blackboard dark theme is
  first-class, not an inversion.
- Calm and exact by construction: the grid makes alignment and object constancy
  visible; the single accent (pen blue) keeps attention on the one change per step.
- Where boldness is spent: the display typeface and the red-pencil ghost. Everything
  else is quiet.

Self-check against generic tells: no cream background + serif + terracotta; not
near-black + one acid accent; no hairline broadsheet; no card kit (panels are
surfaces separated by the grid, not by shadows); no caps eyebrows; no middle-dot
meta strings; mono only where values and code appear, not as decoration.

## 2. Semantic vocabulary (color + non-color cue, both themes)

| semantic | color token | shape / pattern cue | example |
|---|---|---|---|
| compare | `--amber` | bracket connector between the two items + `?` badge | `a[mid]` vs `x` |
| write / move | `--pen` | solid fill; element travels along a path with a short trailing stroke | shift, swap |
| read | `--ink-2` | thin dotted outline pulse | reading `dist[u]` |
| visited | `--ink-2` fill 25 % | dotted fill pattern | BFS visited |
| frontier | `--teal` | dashed ring | in queue / in PQ |
| settled / final | `--ink` | solid fill + small tick in the corner | Dijkstra settled, pivot placed |
| pointer | `--pen` | triangle caret below the cell with the name in mono | `lo` `mid` `hi` |
| invariant region | `--hatch` | 45° hatch pattern + bracket label above | sorted prefix |
| eliminated | `--grid` | cross-hatch + 50 % opacity values | binary search discard |
| stale | `--ink-2` | strikethrough on the panel row + "stale" tag | PQ stale entry |
| error / ghost | `--red` | dashed outline, 40 % opacity, × badge | learner's wrong pick |
| correct | `--green` | 1.5 px ring that draws around the element + ✓ | learner's right pick |
| current line | `--pen` 12 % bg | left bar ▶ in the gutter | code panel |

Contrast: all text ≥ 4.5:1 in both themes; semantic fills ≥ 3:1 against the surface.
Verified in M2 with a contrast script before approval.

## 3. Motion spec (`src/ui/motion.ts`)

Durations: `xs 120` · `s 180` · `m 260` · `l 380` · `xl 560` ms.
Springs (Motion `type: 'spring'`):
- `move`: stiffness 520, damping 42, mass 1 — element travel (no overshoot).
- `settle`: stiffness 400, damping 34 — pointers/carets.
- `sheet`: stiffness 300, damping 26 — ask sheet, tick confirmation (slight overshoot).
Easings for non-spring: `out: cubic-bezier(.2,.7,.2,1)`, `inOut: cubic-bezier(.6,0,.2,1)`.

Step duration at 1× = `l` for moves, `m` for marks/pointers, `s` for compares, and the
play timer uses the step's longest event. Speeds 0.5×/1×/1.5×/2× scale durations.

What animates: x/y of elements, nodes, carets, edge endpoints; region width/x;
opacity on enter/exit; the ✓ ring draw; ghost dash-in; sheet slide. What snaps:
values, text, code highlight, panel row order (rows move, text snaps), colors (120 ms
fade). Scrubbing and `prefers-reduced-motion`: duration 0 for everything; the ✓ and
ghost still appear (instantly). Never animate `width`/`height` of layout elements.

Non-user-triggered motion: exactly one, the landing hero's first move plays once.
No section fade-ins, no hover lifts on cards.

## 4. Component inventory (`src/ui`, `src/render`)

UI: `AppShell`, `TopBar`, `Button` (primary/quiet/danger, 44 px tap targets), `IconButton`,
`Segmented` (level, code/viz tabs), `Select`, `NumberField`, `TextField` (custom input),
`Sheet` (ask container), `Kbd`, `Toast`, `Dialog` (shortcuts `?`, reset), `Tabs`,
`ProgressBar` (session), `Callout` (invariant sentence), `EmptyState`, `Switch`.

Render: `Stage` (svg + viewBox + grid pattern), `ArrayView`, `TreeView`, `GraphView`,
`GridView`, `Bar`, `TNode`, `GNode`, `Edge`, `Caret`, `Region`, `Ghost`, `Link`
(compare bracket), `CorrectRing`, panels `StackPanel`, `QueuePanel`, `PQPanel`,
`CallStackPanel`, `VarsPanel`, `DistTable`, `RecursionTree`, `CodeView`, `Narration`
(with `aria-live="polite"`), `Timeline` (ticks by phase, mistake marks, drag scrub),
`Transport` (play/pause/step/speed), `AskPick`, `AskValue`, `AskOrder`, `AskChoice`,
`ShortcutsOverlay`.

## 5. Screens

**Landing `/`** — Desktop: the top half *is* a live binary-search trace (Stage +
one ask), headline to its left in Bricolage: "Stop watching algorithms. Start tracing
them." One button: "Trace binary search". Below: three short rows explaining the
loop (predict / reveal / re-trace) with a real still from each, then the algorithm
list. Mobile: headline, then the live trace full-width, then the button.

**Library `/algorithms`** — a table, not cards: name, family, what you'll practise,
your accuracy, due badge. Rows link to `/t/<id>`. Filters by family as a segmented
control. Mobile: the same table with two columns.

**Trace `/t/<id>`** — wireframe in §1. Header holds variant + level + custom input
("Edit input" opens a sheet with presets and a validated field). `?` opens
shortcuts. Watch mode is the same screen with no ask sheet and no gating.

**Review `/review`** — "Welcome back — 3 re-traces due, ~4 minutes." One button starts
the first; between items a compact result line ("Dijkstra · 7/8 · 1 stale mistake")
and "Next". Mobile identical.

**Mistake bank `/mistakes`** — grouped by kind, each with its rule sentence, count,
and last seen; expanding a kind lists the exact traces with a "Re-trace this input"
link (same seed). Mobile: an accordion.

**Progress `/progress`** — one chart: prediction accuracy per algorithm over the last
30 days (small multiples, one line each, dataviz skill rules apply), plus a
mistakes-by-kind bar list. No XP, no streaks.

**Settings `/settings`** — theme, motion, default level, export JSON, import JSON,
reset data, feedback link, "Copy my session summary".

**Styleguide `/styleguide`** (dev/M2) — tokens, type, vocabulary, motion playground,
all components, both themes side by side.

## 6. The eight signature moments, concretely

1. **Live hero.** The landing route imports the binary-search module eagerly (it is
   tiny) and mounts `Stage` with preset `basic`, target 42, level guided, `k` at the
   first ask. No signup, no modal. The first click grades, reveals with the ghost,
   and shows the rule. A second ask follows; after two, the button "Keep tracing"
   deep-links into `/t/binary-search` at the same step.
2. **Ghost.** On a wrong `pick`, the trace layer injects a `Ghost` primitive at the
   learner's slot/node with the dashed red-pencil outline; the real move plays in pen
   blue at the same time; the rule sentence replaces the prompt in the sheet. Ghost
   stays until the next ask. Correct: `CorrectRing` draws (260 ms) and the sheet shows
   the next prompt; no confetti, no sound.
3. **Invariant lens.** `Region` primitives are always rendered (never toggled) so the
   band grows/shrinks continuously; the one-sentence invariant sits above the stage
   in `Callout` and re-renders its variables live ("inside [2, 8]").
4. **Timeline.** Ticks per step, colored by phase (`Step.phase`), mistake marks as ×
   at the asks answered wrong, drag to scrub with pointer capture; `k` is exact so
   dragging fast is just index changes with zero-duration transitions.
5. **Linked views.** `hoverId` context; PQ row `ref` → graph node → distance-table
   row; heap array ↔ tree via the same element ids; recursion-tree node ↔ call-stack
   frame via frame id.
6. **Honest algorithms.** Dijkstra's `pop` + `skip` renders the row being struck
   through with the tag "stale: dist already 3" before it disappears; BST delete shows
   the key copy and the successor's own delete instead of a magic swap.
7. **Return experience.** Landing checks the review queue on load: if items are due,
   the hero is replaced by the "Welcome back" block with one button.
8. **Keyboard-first.** Global handler: Space play/pause, ←/→ step, 1–9 answer choices
   (cells and nodes show a small key hint while an ask is open), Enter submit value,
   `?` overlay, `Esc` close. Focus rings are 2 px pen blue, always visible.
