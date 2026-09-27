/** How to execute each module's listings and what they must return (tests only).
 *
 *  Every listing is run on the same inputs and reduced to a list of integers:
 *  - `tokens(input)` is the input as integers, read by the Python / C++ / Java
 *    drivers below (one case per line);
 *  - `expected(input, identity)` is what the listing must print, taken from the
 *    module's `reference` and, where `reference` cannot see it, from the trace's
 *    final state (the element order of an unstable sort, the shape of a BST);
 *  - `js` calls the JavaScript listing directly.
 *  With `identity`, sorts also report which input element ends in each slot, so
 *  the JS and Python listings are checked against the trace's exact permutation
 *  (Lomuto's instability, merge sort's left-first ties), not only the values. */

import type { AlgorithmModule, CodeListing, RealLanguage } from '@/algorithms/types';
import { runModule } from '@/algorithms/_harness';
import type { State } from '@/engine/state';
import type { Id } from '@/engine/events';

import { binarySearch } from '@/algorithms/binary-search';
import type { BinarySearchInput } from '@/algorithms/binary-search';
import { code as binarySearchCode } from '@/algorithms/binary-search/code';
import { quickSort } from '@/algorithms/quick-sort';
import { code as quickSortCode } from '@/algorithms/quick-sort/code';
import { insertionSort } from '@/algorithms/insertion-sort';
import { code as insertionSortCode } from '@/algorithms/insertion-sort/code';
import { mergeSort } from '@/algorithms/merge-sort';
import { code as mergeSortCode } from '@/algorithms/merge-sort/code';
import { dijkstra } from '@/algorithms/dijkstra';
import type { DijkstraInput } from '@/algorithms/dijkstra';
import { code as dijkstraCode } from '@/algorithms/dijkstra/code';
import { bfs } from '@/algorithms/bfs';
import type { BfsInput } from '@/algorithms/bfs';
import { code as bfsCode } from '@/algorithms/bfs/code';
import { bst } from '@/algorithms/bst';
import type { BstInput, BstResult } from '@/algorithms/bst';
import { code as bstCode } from '@/algorithms/bst/code';
import { knapsack } from '@/algorithms/knapsack';
import type { KnapsackInput, KnapsackResult } from '@/algorithms/knapsack';
import { code as knapsackCode } from '@/algorithms/knapsack/code';

export type ExtLang = Exclude<RealLanguage, 'js'>;
export type JsFn = (...args: unknown[]) => unknown;
export type JsExports = Record<string, JsFn>;

export interface CodeCase<I> {
  id: string;
  module: AlgorithmModule<I>;
  code: Record<string, Partial<Record<RealLanguage, CodeListing>>>;
  /** Random-input targets cycled per variant (inputs are filtered by variant). */
  targets: (variant: string) => (string | undefined)[];
  /** Sorts: JS and Python also report element identity. */
  identity: boolean;
  tokens: (input: I) => number[];
  expected: (input: I, identity: boolean) => number[];
  /** Names the JS listing defines, returned from the compiled function. */
  jsExports: (variant: string) => string[];
  js: (fns: JsExports, input: I, variant: string) => number[];
  /** Per-case driver code: `body` runs once per input line; `helpers` sits after the listing. */
  drivers: Record<ExtLang, (variant: string) => { body: string; helpers?: string }>;
}

const call = (fns: JsExports, name: string, ...args: unknown[]): unknown => {
  const f = fns[name];
  if (!f) throw new Error(`listing does not define ${name}`);
  return f(...args);
};

// ---------------------------------------------------------------------------
// sorts

interface Boxed {
  v: number;
  id: number;
  valueOf(): number;
}
const box = (a: readonly number[]): Boxed[] =>
  a.map((v, id) => ({
    v,
    id,
    valueOf() {
      return this.v;
    },
  }));

/** Input index of the element in each slot of 'a' at the end of the trace. */
function traceIdentity(mod: AlgorithmModule<{ a: number[] }>, input: { a: number[] }): number[] {
  const r = runModule(mod, input);
  const final = r.states[r.states.length - 1] as State;
  const slots = final.arrays.a?.slots ?? [];
  return slots.map((id) => Number(String(id).slice(2)));
}

interface SortCalls {
  /** Names the JS listing defines. */
  exports: string[];
  js: (fns: JsExports, a: Boxed[]) => void;
  python: string;
  cpp: string;
  java: string;
}

function sortCase(id: string, mod: AlgorithmModule<{ a: number[] }>, code: CodeCase<{ a: number[] }>['code'], calls: SortCalls): CodeCase<unknown> {
  const c: CodeCase<{ a: number[] }> = {
    id,
    module: mod,
    code,
    targets: () => [undefined, 'duplicates', 'all-equal', 'sorted', 'reverse', 'distinct'],
    identity: true,
    tokens: (input) => [input.a.length, ...input.a],
    expected: (input, identity) => {
      const values = mod.reference(input) as number[];
      return identity ? [...values, ...traceIdentity(mod, input)] : values;
    },
    jsExports: () => calls.exports,
    js: (fns, input) => {
      const a = box(input.a);
      calls.js(fns, a);
      return [...a.map((e) => e.v), ...a.map((e) => e.id)];
    },
    drivers: {
      python: () => ({ body: ['n = nxt()', 'a = [Item(nxt(), k) for k in range(n)]', calls.python, 'emit([e.v for e in a] + [e.id for e in a])'].join('\n') }),
      cpp: () => ({ body: ['int n = nxt();', 'vector<int> a(n);', 'for (auto& e : a) e = nxt();', calls.cpp, 'emit(a);'].join('\n') }),
      java: () => ({ body: ['int n = nxt();', 'int[] a = new int[n];', 'for (int k = 0; k < n; k++) a[k] = nxt();', calls.java, 'emit(a);'].join('\n') }),
    },
  };
  return c as unknown as CodeCase<unknown>;
}

// ---------------------------------------------------------------------------
// graphs

const INF_TOKEN = -1;

const dijkstraCase: CodeCase<DijkstraInput> = {
  id: 'dijkstra',
  module: dijkstra,
  code: dijkstraCode,
  targets: () => [undefined, 'stale', 'unreachable', 'connected'],
  identity: false,
  tokens: (input) => [input.n, input.edges.length, input.s, ...input.edges.flatMap((e) => [e.a, e.b, e.w])],
  expected: (input) => (dijkstra.reference(input) as number[]).map((d) => (d === Infinity ? INF_TOKEN : d)),
  jsExports: () => ['dijkstra'],
  js: (fns, input) => {
    const adj: [number, number][][] = Array.from({ length: input.n }, () => []);
    for (const e of input.edges) {
      adj[e.a]?.push([e.b, e.w]);
      adj[e.b]?.push([e.a, e.w]);
    }
    for (const l of adj) l.sort((p, q) => p[0] - q[0]);
    const dist = call(fns, 'dijkstra', adj, input.s) as number[];
    return dist.map((d) => (d === Infinity ? INF_TOKEN : d));
  },
  drivers: {
    python: () => ({
      body: [
        'n, m, s = nxt(), nxt(), nxt()',
        'adj = [[] for _ in range(n)]',
        'for _ in range(m):',
        '    p, q, wt = nxt(), nxt(), nxt()',
        '    adj[p].append((q, wt))',
        '    adj[q].append((p, wt))',
        'for lst in adj:',
        '    lst.sort()',
        "emit([-1 if d == float('inf') else d for d in dijkstra(adj, s)])",
      ].join('\n'),
    }),
    cpp: () => ({
      body: [
        'int n = nxt(), m = nxt(), s = nxt();',
        'vector<vector<pair<int, int>>> adj(n);',
        'for (int e = 0; e < m; e++) { int p = nxt(), q = nxt(), wt = nxt(); adj[p].push_back({q, wt}); adj[q].push_back({p, wt}); }',
        'for (auto& l : adj) sort(l.begin(), l.end());',
        'vector<int> d = dijkstra(adj, s);',
        'for (auto& x : d) if (x == INT_MAX) x = -1;',
        'emit(d);',
      ].join('\n'),
    }),
    java: () => ({
      body: [
        'int n = nxt(), m = nxt(), s = nxt();',
        'List<List<int[]>> adj = new ArrayList<>();',
        'for (int k = 0; k < n; k++) adj.add(new ArrayList<>());',
        'for (int e = 0; e < m; e++) { int p = nxt(), q = nxt(), wt = nxt(); adj.get(p).add(new int[] {q, wt}); adj.get(q).add(new int[] {p, wt}); }',
        'for (List<int[]> l : adj) l.sort((x, y) -> x[0] - y[0]);',
        'int[] d = dijkstra(adj, s);',
        'for (int k = 0; k < n; k++) if (d[k] == Integer.MAX_VALUE) d[k] = -1;',
        'emit(d);',
      ].join('\n'),
    }),
  },
};

const bfsCase: CodeCase<BfsInput> = {
  id: 'bfs',
  module: bfs,
  code: bfsCode,
  targets: () => [undefined, 'connected', 'unreachable', 'wide'],
  identity: false,
  tokens: (input) => [input.n, input.edges.length, input.s, ...input.edges.flatMap((e) => [e.a, e.b])],
  expected: (input) => (bfs.reference(input) as (number | null)[]).map((d) => (d === null ? INF_TOKEN : d)),
  jsExports: () => ['bfs'],
  js: (fns, input) => {
    const adj: number[][] = Array.from({ length: input.n }, () => []);
    for (const e of input.edges) {
      adj[e.a]?.push(e.b);
      adj[e.b]?.push(e.a);
    }
    for (const l of adj) l.sort((p, q) => p - q);
    return call(fns, 'bfs', adj, input.s) as number[];
  },
  drivers: {
    python: () => ({
      body: [
        'n, m, s = nxt(), nxt(), nxt()',
        'adj = [[] for _ in range(n)]',
        'for _ in range(m):',
        '    p, q = nxt(), nxt()',
        '    adj[p].append(q)',
        '    adj[q].append(p)',
        'for lst in adj:',
        '    lst.sort()',
        'emit(bfs(adj, s))',
      ].join('\n'),
    }),
    cpp: () => ({
      body: [
        'int n = nxt(), m = nxt(), s = nxt();',
        'vector<vector<int>> adj(n);',
        'for (int e = 0; e < m; e++) { int p = nxt(), q = nxt(); adj[p].push_back(q); adj[q].push_back(p); }',
        'for (auto& l : adj) sort(l.begin(), l.end());',
        'emit(bfs(adj, s));',
      ].join('\n'),
    }),
    java: () => ({
      body: [
        'int n = nxt(), m = nxt(), s = nxt();',
        'List<List<Integer>> adj = new ArrayList<>();',
        'for (int k = 0; k < n; k++) adj.add(new ArrayList<>());',
        'for (int e = 0; e < m; e++) { int p = nxt(), q = nxt(); adj.get(p).add(q); adj.get(q).add(p); }',
        'for (List<Integer> l : adj) Collections.sort(l);',
        'emit(bfs(adj, s));',
      ].join('\n'),
    }),
  },
};

// ---------------------------------------------------------------------------
// BST

/** Pre-order keys of the trace's final tree: the shape, which in-order cannot show. */
function tracePreorder(input: BstInput): number[] {
  const r = runModule(bst, input);
  const final = r.states[r.states.length - 1] as State;
  const out: number[] = [];
  const walk = (id: Id | null): void => {
    if (id === null) return;
    const n = final.tree[id];
    if (!n) return;
    out.push(n.key);
    walk(n.left);
    walk(n.right);
  };
  walk(final.root);
  return out;
}

const bstExpected = (input: BstInput): number[] => {
  const ref = bst.reference(input) as BstResult;
  const pre = tracePreorder(input);
  return [ref.found ? 1 : 0, ref.path.length, ...ref.path, ref.inorder.length, ...ref.inorder, pre.length, ...pre];
};

interface JsNode {
  key: number;
  left: JsNode | null;
  right: JsNode | null;
}

const bstCase: CodeCase<BstInput> = {
  id: 'bst',
  module: bst,
  code: bstCode,
  targets: (variant) => (variant === 'delete' ? ['delete', 'two-children', 'one-child', 'leaf', 'root', 'miss'] : [variant]),
  identity: false,
  tokens: (input) => [input.keys.length, ...input.keys, input.x],
  expected: bstExpected,
  jsExports: (variant) => ['Node', 'insert', ...(variant === 'delete' ? ['deleteNode'] : variant === 'search' ? ['search'] : [])],
  js: (fns, input, variant) => {
    let root: JsNode | null = null;
    for (const k of input.keys) root = call(fns, 'insert', root, k) as JsNode;
    const path: number[] = [];
    let found = 0;
    for (let cur = root; cur !== null; cur = input.x < cur.key ? cur.left : cur.right) {
      path.push(cur.key);
      if (cur.key === input.x) {
        found = 1;
        break;
      }
    }
    if (variant === 'insert') root = call(fns, 'insert', root, input.x) as JsNode;
    else if (variant === 'delete') root = call(fns, 'deleteNode', root, input.x) as JsNode | null;
    else {
      const hit = call(fns, 'search', root, input.x) as JsNode | null;
      found = hit !== null && hit.key === input.x ? 1 : 0;
    }
    const ino: number[] = [];
    const pre: number[] = [];
    const walk = (t: JsNode | null): void => {
      if (t === null) return;
      pre.push(t.key);
      walk(t.left);
      ino.push(t.key);
      walk(t.right);
    };
    walk(root);
    return [found, path.length, ...path, ino.length, ...ino, pre.length, ...pre];
  },
  drivers: {
    python: (variant) => ({
      helpers: [
        'def orders(root):',
        '    ino, pre = [], []',
        '    def walk(t):',
        '        if t is None:',
        '            return',
        '        pre.append(t.key)',
        '        walk(t.left)',
        '        ino.append(t.key)',
        '        walk(t.right)',
        '    walk(root)',
        '    return [len(ino)] + ino + [len(pre)] + pre',
      ].join('\n'),
      body: [
        'k = nxt()',
        'keys = [nxt() for _ in range(k)]',
        'x = nxt()',
        'root = None',
        'for key in keys:',
        '    root = insert(root, key)',
        'path, cur, found = [], root, 0',
        'while cur is not None:',
        '    path.append(cur.key)',
        '    if cur.key == x:',
        '        found = 1',
        '        break',
        '    cur = cur.left if x < cur.key else cur.right',
        variant === 'insert'
          ? 'root = insert(root, x)'
          : variant === 'delete'
            ? 'root = delete_node(root, x)'
            : 'hit = search(root, x)\nfound = 1 if hit is not None and hit.key == x else 0',
        'emit([found, len(path)] + path + orders(root))',
      ].join('\n'),
    }),
    cpp: (variant) => ({
      helpers: [
        'void orders(Node* t, vector<int>& ino, vector<int>& pre) {',
        '    if (!t) return;',
        '    pre.push_back(t->key);',
        '    orders(t->left, ino, pre);',
        '    ino.push_back(t->key);',
        '    orders(t->right, ino, pre);',
        '}',
      ].join('\n'),
      body: [
        'int k = nxt();',
        'vector<int> keys(k);',
        'for (auto& e : keys) e = nxt();',
        'int x = nxt();',
        'Node* root = nullptr;',
        'for (int key : keys) root = insert(root, key);',
        'vector<int> path; int found = 0;',
        'for (Node* cur = root; cur; cur = x < cur->key ? cur->left : cur->right) { path.push_back(cur->key); if (cur->key == x) { found = 1; break; } }',
        variant === 'insert'
          ? 'root = insert(root, x);'
          : variant === 'delete'
            ? 'root = deleteNode(root, x);'
            : 'Node* hit = search(root, x); found = hit && hit->key == x ? 1 : 0;',
        'vector<int> ino, pre, o{found, (int)path.size()};',
        'orders(root, ino, pre);',
        'o.insert(o.end(), path.begin(), path.end());',
        'o.push_back((int)ino.size()); o.insert(o.end(), ino.begin(), ino.end());',
        'o.push_back((int)pre.size()); o.insert(o.end(), pre.begin(), pre.end());',
        'emit(o);',
      ].join('\n'),
    }),
    java: (variant) => ({
      helpers: [
        'static void orders(Node t, List<Integer> ino, List<Integer> pre) {',
        '    if (t == null) return;',
        '    pre.add(t.key);',
        '    orders(t.left, ino, pre);',
        '    ino.add(t.key);',
        '    orders(t.right, ino, pre);',
        '}',
      ].join('\n'),
      body: [
        'int k = nxt();',
        'int[] keys = new int[k];',
        'for (int q = 0; q < k; q++) keys[q] = nxt();',
        'int x = nxt();',
        'Node root = null;',
        'for (int key : keys) root = insert(root, key);',
        'List<Integer> path = new ArrayList<>(); int found = 0;',
        'for (Node cur = root; cur != null; cur = x < cur.key ? cur.left : cur.right) { path.add(cur.key); if (cur.key == x) { found = 1; break; } }',
        variant === 'insert'
          ? 'root = insert(root, x);'
          : variant === 'delete'
            ? 'root = deleteNode(root, x);'
            : 'Node hit = search(root, x); found = hit != null && hit.key == x ? 1 : 0;',
        'List<Integer> ino = new ArrayList<>(), pre = new ArrayList<>(), o = new ArrayList<>();',
        'orders(root, ino, pre);',
        'o.add(found); o.add(path.size()); o.addAll(path);',
        'o.add(ino.size()); o.addAll(ino); o.add(pre.size()); o.addAll(pre);',
        'emit(o);',
      ].join('\n'),
    }),
  },
};

// ---------------------------------------------------------------------------
// binary search, knapsack

const binarySearchCase: CodeCase<BinarySearchInput> = {
  id: 'binary-search',
  module: binarySearch,
  code: binarySearchCode,
  targets: (variant) => [variant, 'present', 'absent', 'duplicates'],
  identity: false,
  tokens: (input) => [input.a.length, ...input.a, input.x],
  expected: (input) => [binarySearch.reference(input) as number],
  jsExports: (variant) => [variant === 'lower' ? 'lowerBound' : 'binarySearch'],
  js: (fns, input, variant) => [call(fns, variant === 'lower' ? 'lowerBound' : 'binarySearch', input.a.slice(), input.x) as number],
  drivers: {
    python: (variant) => ({ body: ['n = nxt()', 'a = [nxt() for _ in range(n)]', 'x = nxt()', `emit([${variant === 'lower' ? 'lower_bound' : 'binary_search'}(a, x)])`].join('\n') }),
    cpp: (variant) => ({
      body: ['int n = nxt();', 'vector<int> a(n);', 'for (auto& e : a) e = nxt();', 'int x = nxt();', `emit(vector<int>{${variant === 'lower' ? 'lowerBound' : 'binarySearch'}(a, x)});`].join('\n'),
    }),
    java: (variant) => ({
      body: ['int n = nxt();', 'int[] a = new int[n];', 'for (int k = 0; k < n; k++) a[k] = nxt();', 'int x = nxt();', `emit(new int[] {${variant === 'lower' ? 'lowerBound' : 'binarySearch'}(a, x)});`].join('\n'),
    }),
  },
};

const knapsackCase: CodeCase<KnapsackInput> = {
  id: 'knapsack',
  module: knapsack,
  code: knapsackCode,
  targets: () => [undefined, 'tie', 'all-fit', 'partial'],
  identity: false,
  tokens: (input) => [input.w.length, ...input.w, ...input.v, input.W],
  expected: (input) => {
    const r = knapsack.reference(input) as KnapsackResult;
    return [r.best, r.taken.length, ...r.taken];
  },
  jsExports: () => ['knapsack'],
  js: (fns, input) => {
    const r = call(fns, 'knapsack', input.w.slice(), input.v.slice(), input.W) as { best: number; taken: number[] };
    return [r.best, r.taken.length, ...r.taken];
  },
  drivers: {
    python: () => ({ body: ['n = nxt()', 'w = [nxt() for _ in range(n)]', 'v = [nxt() for _ in range(n)]', 'W = nxt()', 'best, taken = knapsack(w, v, W)', 'emit([best, len(taken)] + taken)'].join('\n') }),
    cpp: () => ({
      body: [
        'int n = nxt();',
        'vector<int> w(n), v(n);',
        'for (auto& e : w) e = nxt();',
        'for (auto& e : v) e = nxt();',
        'int W = nxt();',
        'auto [best, taken] = knapsack(w, v, W);',
        'vector<int> o{best, (int)taken.size()};',
        'o.insert(o.end(), taken.begin(), taken.end());',
        'emit(o);',
      ].join('\n'),
    }),
    java: () => ({
      body: [
        'int n = nxt();',
        'int[] w = new int[n], v = new int[n];',
        'for (int k = 0; k < n; k++) w[k] = nxt();',
        'for (int k = 0; k < n; k++) v[k] = nxt();',
        'int W = nxt();',
        'Result r = knapsack(w, v, W);',
        'List<Integer> o = new ArrayList<>();',
        'o.add(r.best()); o.add(r.taken().size()); o.addAll(r.taken());',
        'emit(o);',
      ].join('\n'),
    }),
  },
};

const erase = <I>(c: CodeCase<I>): CodeCase<unknown> => c as unknown as CodeCase<unknown>;
const sortMod = <I>(m: AlgorithmModule<I>): AlgorithmModule<{ a: number[] }> => m as unknown as AlgorithmModule<{ a: number[] }>;

export const CASES: CodeCase<unknown>[] = [
  erase(binarySearchCase),
  sortCase('quick-sort', sortMod(quickSort), quickSortCode, {
    exports: ['quickSort', 'partition'],
    js: (fns, a) => call(fns, 'quickSort', a, 0, a.length - 1),
    python: 'quick_sort(a, 0, n - 1)',
    cpp: 'quickSort(a, 0, n - 1);',
    java: 'quickSort(a, 0, n - 1);',
  }),
  erase(dijkstraCase),
  erase(bstCase),
  sortCase('insertion-sort', sortMod(insertionSort), insertionSortCode, {
    exports: ['insertionSort'],
    js: (fns, a) => call(fns, 'insertionSort', a),
    python: 'insertion_sort(a)',
    cpp: 'insertionSort(a);',
    java: 'insertionSort(a);',
  }),
  sortCase('merge-sort', sortMod(mergeSort), mergeSortCode, {
    exports: ['mergeSort', 'merge'],
    js: (fns, a) => call(fns, 'mergeSort', a, new Array(a.length), 0, a.length - 1),
    python: 'aux = [None] * n\nmerge_sort(a, aux, 0, n - 1)',
    cpp: 'vector<int> aux(n);\nmergeSort(a, aux, 0, n - 1);',
    java: 'int[] aux = new int[n];\nmergeSort(a, aux, 0, n - 1);',
  }),
  erase(bfsCase),
  erase(knapsackCase),
];
