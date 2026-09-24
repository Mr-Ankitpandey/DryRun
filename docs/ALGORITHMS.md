# DryRun — algorithm specifications

Status: draft for owner review. Last updated: 2026-09-25.

Conventions for every module:
- Pseudocode lines are 1-based and are what `Step.line` refers to.
- "Ask" rows list `kind` · level (G = guided, F = full) · prompt · answer · distractors
  with mistake kind.
- Narration: present tense, one sentence, names the rule not the mechanics
  ("`mid` is 42's index? No: 42 > 30, so everything up to `mid` is out.").
- Tie-break rules are stated in the UI under the title and are part of the module meta.
- Input constraints exist for pedagogy first (fits in the head, fits on a phone),
  performance second.

## 1. Binary search (classic + lower-bound variant)

Renderer: array with carets `lo`, `mid`, `hi`. Invariant lens: eliminated range
greyed with a hatch; sentence: "If the target is present, it is inside `[lo, hi]`."

Pseudocode (classic, `v=classic`):
```
1  lo = 0, hi = n - 1
2  while lo <= hi:
3      mid = lo + (hi - lo) / 2          // floor; overflow-safe form
4      if a[mid] == x: return mid
5      else if a[mid] < x: lo = mid + 1
6      else: hi = mid - 1
7  return -1
```
Lower bound (`v=lower`), first index with `a[i] >= x`:
```
1  lo = 0, hi = n
2  while lo < hi:
3      mid = lo + (hi - lo) / 2
4      if a[mid] < x: lo = mid + 1
5      else: hi = mid
6  return lo
```
Events per iteration: `pointer mid` → `compare a[mid] vs x` (+ `var`) → `pointer lo|hi`
+ `region eliminated`. Loop end: `var lo/hi`, `region eliminated` full, final `mark done`
on the answer element or note "not found".

Asks:
| kind | lvl | prompt | answer | distractors |
|---|---|---|---|---|
| pick | G | Where does `mid` land? | slot of floor mid | ceil mid → `boundary`; `lo` → `boundary` |
| choice | F | Compare `a[mid]` with `x`: what happens? | `lo = mid+1` / `hi = mid−1` / `found` | swapped direction → `comparison` |
| pick | G | Where does `lo` (or `hi`) move? | mid+1 (mid−1) | `mid` → `boundary`; `mid+2` → `boundary` |
| choice | F | Does the loop continue? | yes/no | wrong → `base-case` (`lo <= hi` vs `lo < hi`) |
| value | G | Result index (−1 if absent)? | index | last `mid` → `boundary` |

Presets: `basic` (n=9, present), `absent`, `empty`, `single`, `duplicates` (lower-bound
shows the first), `first`/`last` element, `all-equal`. Random: sorted distinct or with
duplicates, n ∈ [5, 16], target chosen present 60 % / absent 40 %.
Constraints: n ≤ 16, values 0–99. Steps ≤ 40.
Pitfalls: students compute `mid` by ceiling; move `lo = mid`; forget `hi = mid−1`
(infinite loop in lower-bound if `hi = mid−1` is used there).

## 2. Insertion sort

Renderer: array + a lifted `key` element. Invariant: sorted prefix `[0, i)` shaded;
sentence: "Everything left of `i` is sorted; `key` slides left until it is not smaller."

```
1  for i = 1 .. n-1:
2      key = a[i]; j = i - 1
3      while j >= 0 and a[j] > key:
4          a[j+1] = a[j]              // shift, not swap
5          j = j - 1
6      a[j+1] = key
```
Events: `mark key` lifts the element (rendered above the row), each shift is a `move`
of `e:j` to slot `j+1` (the key's slot is "empty" during the pass), final `move key`
into `j+1`, then `region sorted [0, i]`. `compare` uses `>` so equal keys stop:
stability is visible with duplicates (equal element stays right).

Asks: pick · G · "Which element shifts next?" (answer `e:j`; distractors: `key` →
`shift-vs-swap`, `e:j−1` → `boundary`); pick · G · "Where does `key` land?" (slot j+1;
distractors: slot j → `comparison` when `a[j] == key`, slot 0 → `boundary`); choice · F ·
"Does `a[j]` shift?" (yes/no; wrong → `comparison`).
Presets: `random`, `sorted` (0 shifts), `reverse` (max shifts), `duplicates`,
`all-equal`, `single`, `empty`. n ≤ 12, values 0–99. Steps ≤ 160.
Pitfall: swaps instead of shifts; `a[j] >= key` (breaks stability); off-by-one in `j+1`.

## 3. Quick sort (Lomuto)

Renderer: array + call stack panel + recursion tree (segment nodes aligned to the
array). Invariant: regions `less` `[lo, i]`, `greaterEq` `[i+1, j)`, `unscanned`
`[j, hi)`, `pivot` at `hi`. Sentence: "Left of `i+1` is `< pivot`; between `i+1` and
`j` is `≥ pivot`; `j` onward is unscanned."

```
1  quicksort(lo, hi):
2      if lo >= hi: return
3      p = partition(lo, hi)
4      quicksort(lo, p - 1)
5      quicksort(p + 1, hi)
6  partition(lo, hi):
7      pivot = a[hi]; i = lo - 1
8      for j = lo .. hi - 1:
9          if a[j] < pivot:
10             i = i + 1; swap a[i], a[j]
11     swap a[i+1], a[hi]
12     return i + 1
```
Events: `call`/`return` (frames are the call stack; no panel pushes); `mark pivot`;
per `j`: `compare` then optional `swap` + region updates; final `swap` + `mark done`
on the pivot (settled). Size 0/1 segments produce a `call` + immediate `return` (base
case is visible, not skipped). All-equal input: every compare is false → pivot ends at
`lo` → worst case; the recursion tree makes the O(n²) shape visible.

Asks: choice · F · "Does `a[j]` swap with `a[i+1]`?" (wrong → `comparison`, distractor
`<=` semantics); pick · G · "Where does the pivot land?" (slot i+1; distractors: `i` →
`boundary`, midpoint → `unclassified`); pick · G · "Which segment is sorted next?"
(recursion-tree node `[lo, p−1]`; distractor right segment → `order`); choice · F · "This
call: recurse or return?" (wrong → `base-case`).
Presets: `random`, `sorted` (worst case), `all-equal`, `duplicates`, `two`, `single`.
n ≤ 12. Steps ≤ 320 (n=12 worst case ≈ 12+11+…+1 compares ≈ 66 compares + calls).
Pitfalls: thinking Lomuto is Hoare (two-pointer); swapping on `<=`; forgetting the
final pivot swap; wrong recursion bounds (`p` included).

## 4. Merge sort (top-down, stable)

Renderer: recursion tree + array + aux array. Invariant: each finished node is a
sorted run (region `sorted` on that segment); sentence: "Both halves are sorted; take
the smaller front, left first on ties."

```
1  mergesort(lo, hi):
2      if hi - lo < 1: return
3      mid = lo + (hi - lo) / 2
4      mergesort(lo, mid); mergesort(mid + 1, hi)
5      merge(lo, mid, hi)
6  merge(lo, mid, hi):
7      i = lo; j = mid + 1; k = lo
8      while i <= mid and j <= hi:
9          if a[i] <= a[j]: aux[k++] = a[i++]
10         else:            aux[k++] = a[j++]
11     copy the rest of the left half, then the right half
12     copy aux[lo..hi] back to a
```
Events: `call`/`return`; `array aux` declared once; during merge each copy is a
`compare` + `move` of the element into `aux` slot k (identity moves to the aux row, so
the element visibly travels down); the copy-back is one step of `move`s back up (one
semantic change: "the run is written back"). Odd lengths: `mid` floors, left half is
the shorter-or-equal one.

Asks: pick · G · "Which element is copied next?" (answer `e:i` or `e:j`; distractors: the
other → `comparison`, ties: right one → `order` "left first on ties"); choice · F ·
"Which call returns next?" (options are the open frames; wrong → `order`); value · F ·
"How many elements remain in the left run?" (wrong → `boundary`).
Presets: `random`, `odd-length` (n=7), `duplicates`, `sorted`, `reverse`, `two`, `single`.
n ≤ 16 (power of two not required). Steps ≤ 220.
Pitfalls: `mid` rounding; taking the right element on ties; forgetting the leftover copy.

## 5. BST insert / search / delete

Renderer: tree. Invariant: the BST property on the search path; sentence: "Everything
left of a node is smaller; everything right is larger." Duplicates: rejected by the
input validator ("BSTs here hold distinct keys").

Operations (`op=insert|search|delete`, key `x`), on a tree built from the input list in
order (the build is shown as a collapsed prelude, scrubbable):
```
1  insert(node, x):
2      if node is null: return new Node(x)
3      if x < node.key: node.left = insert(node.left, x)
4      else: node.right = insert(node.right, x)
5      return node
6  delete(node, x):
7      if node is null: return null
8      if x < node.key: node.left = delete(node.left, x)
9      else if x > node.key: node.right = delete(node.right, x)
10     else if node.left is null: return node.right          // 0 or 1 child
11     else if node.right is null: return node.left
12     else: s = min(node.right); node.key = s.key;         // two children
13           node.right = delete(node.right, s.key)
14     return node
```
Events: `mark active` walks the path (one step per node, `compare` with `x`); insert:
`node.add` with parent and side; delete: case 10/11 → `node.relink` of the child onto
the grandparent then `node.remove`; case 12 → walk to the successor (`mark active`),
`node.set` key copy (both nodes flash), then the successor is deleted by case 10
(`node.relink`/`node.remove`). Deleting the root is the same code path with parent
`null`. Layout is path-based, so only relinked nodes move.

Asks: pick · G · "Next node on the path?" (child; distractor other child → `subtree`);
choice · G · "Which delete case applies?" (leaf / one child / two children; wrong →
`base-case`); pick · G · "Who is the in-order successor?" (min of right subtree;
distractors: right child → `subtree`, max of left → `subtree`); pick · F · "Which node is
relinked?" (wrong → `subtree`).
Presets: `balanced`, `delete-leaf`, `delete-one-child`, `delete-two-children`,
`delete-root`, `search-miss`, `insert-left-spine`. Nodes ≤ 15, depth ≤ 5 (validator
rejects deeper). Steps ≤ 60 (+ build prelude ≤ 45).
Pitfall: successor = right child; predecessor/successor confusion; forgetting the
recursive delete of the successor.

## 6. BFS (undirected, unweighted)

Renderer: graph + queue panel + a small distance/layer table. Invariant: `settled`
(dequeued) vs `frontier` (in queue) vs unseen; sentence: "Everything in the queue is
at distance `d` or `d+1`; layers come out in order." Tie-break: neighbours are
visited in ascending node id.

```
1  dist[s] = 0; queue = [s]; mark s visited
2  while queue not empty:
3      u = dequeue()
4      for v in neighbours(u) in ascending id:
5          if v not visited:
6              mark v visited; dist[v] = dist[u] + 1
7              enqueue(v)
```
Events: `push`/`pop` on `queue`; `mark frontier` on enqueue, `mark settled` on dequeue;
`label` node with `dist`; `edge.mark tree` on discovery; `read` on already-visited
neighbours (a visible "skipped" beat). Disconnected components stay unmarked and the
final note says which nodes are unreachable.

Asks: pick · G · "Which node is dequeued next?" (front; distractor back → `order`
"queue, not stack"); order · G · "Queue contents after this step, front first" (answer
`Id[]`; distractor reverse → `order`, missing an already-visited node → `comparison`);
value · F · "`dist` of this node?" (wrong → `boundary`).
Presets: `tree-like`, `cycle`, `disconnected`, `complete-4`, `line`. Nodes ≤ 12, edges
≤ 20. Steps ≤ 120.
Pitfall: treating the queue as a stack; enqueueing an already-visited node; wrong
neighbour order.

## 7. Dijkstra (binary heap, lazy deletion)

Renderer: graph + PQ panel + distance table. Invariant: `settled` set's distances are
final; sentence: "A popped node with a fresh entry is done: nothing can shorten it."
Tie-break: PQ orders by `(dist, node id)`. Negative weights are rejected by the
validator with "Dijkstra assumes non-negative edges: with a negative edge a settled
node could still be improved."

```
1  dist[*] = ∞; dist[s] = 0; pq = {(0, s)}
2  while pq not empty:
3      (d, u) = pq.popMin()
4      if d > dist[u]: continue           // stale entry
5      mark u settled
6      for (u, v, w) in edges of u, ascending v:
7          if dist[u] + w < dist[v]:
8              dist[v] = dist[u] + w
9              pq.push((dist[v], v))      // old entry stays: lazy deletion
```
Events: `push` PQ items `{id: 'q:n', key: d, ref: 'n:v', label: '(d, v)'}`; `pop` by
explicit id; stale pop = `pop` + `skip` + `mark stale` on the row's ghost in the panel
for one step; `mark settled`; per edge `compare` (`read` edge, `edge.mark relaxed` or
`rejected`) and `label` with the new `dist`. Unreachable nodes keep `∞`.

Asks: pick · G · "Which node pops next?" (min `(dist, id)`; distractors: next by id →
`order`, larger dist → `comparison`); choice · G · "Is this entry stale?" (yes/no; wrong →
`stale`); value · G · "New `dist[v]` after relaxing this edge?" (distractors: old dist →
`comparison`, `w` alone → `dependency`); order · F · "PQ pop order from here (assuming
no more pushes)" (wrong → `order`).
Presets: `stale-entry` (guaranteed stale pop), `unreachable`, `equal-weights`,
`two-paths`, `line`. Random generator retries until a stale pop exists (target
`stale`). Nodes ≤ 10, edges ≤ 18, weights 1–9. Steps ≤ 200.
Pitfall: decreasing a key "in place" in the mental model; settling on push instead of
pop; not knowing what to do with the stale entry.

## 8. 0/1 knapsack (chosen over LCS)

Why knapsack: it is the canonical DP for this audience, its grid reads naturally
(items × capacity), and its signature bug (reading `dp[i][c − w]` from the *current*
row, which silently computes the unbounded knapsack) is a precise mental-model error
that DryRun can name. LCS remains the next DP module to add after launch.

Renderer: DP grid (rows = items 0..n, cols = capacity 0..W) with dependency arrows;
item list on the side. Invariant: computed cells are final; fill order is row-major;
sentence: "`dp[i][c]` uses only the row above."

```
1  dp[0][*] = 0
2  for i = 1 .. n:
3      for c = 0 .. W:
4          dp[i][c] = dp[i-1][c]                          // skip item i
5          if w[i] <= c:
6              dp[i][c] = max(dp[i][c], dp[i-1][c - w[i]] + v[i])   // take item i
7  reconstruct: from (n, W), if dp[i][c] != dp[i-1][c] item i is taken, c -= w[i]
```
Events: `cell` with `deps` (`[i−1, c]` and, if it fits, `[i−1, c−w]`); the ask precedes
the write. Reconstruction: `mark done` on chosen cells, `read` up the path; ties (both
choices give the same value) are resolved as "skip" (`dp[i][c] == dp[i−1][c]` → not
taken), stated in the UI.

Asks: value · G · "Value of `dp[i][c]`?" (distractors: `dp[i−1][c−w] + v` when it isn't
the max → `comparison`; `dp[i][c−w] + v` (current row) → `dependency`; `dp[i−1][c]`
when take wins → `comparison`); pick · F · "Which cell does this read besides the one
above?" (`[i−1, c−w]`; distractor `[i, c−w]` → `dependency`); choice · F · "Is item `i`
taken in the answer?" (wrong → `dependency`).
Presets: `classic` (4 items, W=7), `zero-capacity`, `one-item`, `item-too-heavy`,
`tie` (two optimal subsets), `all-fit`. Items ≤ 5, W ≤ 10, weights 1–6, values 1–20.
Steps ≤ 80.
Pitfall: current-row read (unbounded), `<` instead of `<=` in the fit test, wrong
reconstruction direction.

## Cross-cutting rules

- Every module ships `reference()` (plain implementation) and `invariantCheck()`;
  property tests run 1,000 random inputs.
- `randomInput(rng, target)` retries up to 50 times to hit `target` (e.g. `stale`,
  `two-children`), then falls back to the matching preset. Tested.
- Step caps are asserted in tests over the random distribution.
- Narration never uses "we"; it names the rule.
