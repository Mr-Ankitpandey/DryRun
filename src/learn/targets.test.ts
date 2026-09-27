import { describe, expect, it } from 'vitest';
import { registry } from '@/algorithms/registry';
import type { DfsInput } from '@/algorithms/dfs';
import { hasBackEdge, maxDepth, treeCount } from '@/algorithms/dfs/input';
import type { LcsInput } from '@/algorithms/lcs';
import { reference as lcsReference } from '@/algorithms/lcs';
import { walkHasTie } from '@/algorithms/lcs/input';
import type { AlgorithmModule } from '@/algorithms/types';
import type { BfsInput } from '@/algorithms/bfs/generator';
import { maxQueue, referenceDistances as bfsDistances } from '@/algorithms/bfs/input';
import type { BstInput } from '@/algorithms/bst/generator';
import { plainBuild } from '@/algorithms/bst/input';
import type { PlainNode } from '@/algorithms/bst/input';
import type { DijkstraInput } from '@/algorithms/dijkstra/generator';
import { hasStalePop } from '@/algorithms/dijkstra/input';
import type { KnapsackInput } from '@/algorithms/knapsack/generator';
import { hasTie } from '@/algorithms/knapsack/input';
import type { Step } from '@/engine/events';
import { createRng } from '@/lib/rng';
import type { MistakeKind } from '@/trace/asks';
import { MISTAKE_LABELS } from '@/trace/asks';
import { KIND_STUMBLE, MISTAKE_TARGETS, targetFor, targetSentence, targetedKinds } from './targets';

const SEEDS = 25;

interface ArrayInput {
  a: number[];
}
interface SearchInput extends ArrayInput {
  x: number;
}

const arr = (input: unknown): number[] => (input as ArrayInput).a;
const hasDuplicates = (a: readonly number[]) => new Set(a).size < a.length;
const nonDecreasing = (a: readonly number[]) => a.every((v, i) => i === 0 || (a[i - 1] as number) <= v);
const strictlyDecreasing = (a: readonly number[]) => a.every((v, i) => i === 0 || (a[i - 1] as number) > v);

function childCount(keys: readonly number[], x: number): number {
  let n: PlainNode | null = plainBuild(keys);
  while (n !== null && n.key !== x) n = x < n.key ? n.left : n.right;
  if (n === null) return -1;
  return (n.left === null ? 0 : 1) + (n.right === null ? 0 : 1);
}

/** The case each target promises, checked on the generated input and its steps. */
const CASE_CHECKS: Record<string, (input: unknown, steps: readonly Step[]) => boolean> = {
  'binary-search:absent': (i) => !(i as SearchInput).a.includes((i as SearchInput).x),
  'quick-sort:duplicates': (i) => hasDuplicates(arr(i)),
  'quick-sort:sorted': (i, steps) => nonDecreasing(arr(i)) && steps.filter((s) => s.note.includes('the segment is empty')).length >= 2,
  'quick-sort:distinct': (i) => !hasDuplicates(arr(i)),
  'quick-sort:reverse': (i) => {
    const a = arr(i);
    return a.every((v, k) => k === 0 || (a[k - 1] as number) >= v) && Math.min(...a) === a[a.length - 1];
  },
  'dijkstra:stale': (i, steps) => hasStalePop(i as DijkstraInput) && steps.some((s) => s.events.some((e) => e.t === 'skip')),
  'bst:two-children': (i, steps) =>
    (i as BstInput).op === 'delete' &&
    childCount((i as BstInput).keys, (i as BstInput).x) === 2 &&
    steps.filter((s) => s.ask?.prompt.includes('which delete case applies')).length === 2,
  'bst:one-child': (i) => (i as BstInput).op === 'delete' && childCount((i as BstInput).keys, (i as BstInput).x) === 1,
  'insertion-sort:duplicates': (i) => hasDuplicates(arr(i)),
  'insertion-sort:reverse': (i) => strictlyDecreasing(arr(i)),
  'insertion-sort:distinct': (i) => !hasDuplicates(arr(i)),
  'merge-sort:duplicates': (i) => hasDuplicates(arr(i)),
  'merge-sort:distinct': (i) => !hasDuplicates(arr(i)),
  'merge-sort:odd-length': (i) => arr(i).length % 2 === 1,
  'bfs:wide': (i) => maxQueue(i as BfsInput) >= 3,
  'bfs:connected': (i) => bfsDistances(i as BfsInput).every((d) => d !== null),
  'knapsack:tie': (i) => hasTie(i as KnapsackInput),
  'dfs:back-edge': (i) => hasBackEdge(i as DfsInput),
  'dfs:deep': (i) => maxDepth(i as DfsInput) >= 5,
  'dfs:forest': (i) => treeCount(i as DfsInput) >= 2,
  'lcs:tie': (i) => walkHasTie(i as LcsInput),
  'lcs:long': (i) => lcsReference(i as LcsInput).length >= 3,
  'knapsack:partial': (i) => {
    const k = i as KnapsackInput;
    return k.w.reduce((s, x) => s + x, 0) > k.W;
  },
};

const modules = new Map<string, AlgorithmModule<unknown>>();
async function load(id: string): Promise<AlgorithmModule<unknown>> {
  const cached = modules.get(id);
  if (cached) return cached;
  const entry = registry.find((e) => e.id === id);
  if (!entry) throw new Error(`no registry entry for ${id}`);
  const m = await entry.load();
  modules.set(id, m);
  return m;
}

const pairs = Object.entries(MISTAKE_TARGETS).flatMap(([algorithm, kinds]) =>
  Object.entries(kinds).map(([kind, t]) => ({ algorithm, kind: kind as MistakeKind, target: (t as { target: string }).target })),
);

describe('targets table', () => {
  it('covers every algorithm with targetable mistakes, and only registered ones', () => {
    const ids = registry.map((e) => e.id);
    for (const id of Object.keys(MISTAKE_TARGETS)) expect(ids).toContain(id);
    expect(Object.keys(MISTAKE_TARGETS).sort()).toEqual(
      ['bfs', 'binary-search', 'bst', 'dfs', 'dijkstra', 'insertion-sort', 'knapsack', 'lcs', 'merge-sort', 'quick-sort'].sort(),
    );
  });

  it('never maps unclassified, and every mapped target has a case check', () => {
    for (const p of pairs) {
      expect(p.kind).not.toBe('unclassified');
      expect(p.kind in MISTAKE_LABELS).toBe(true);
      expect(CASE_CHECKS[`${p.algorithm}:${p.target}`], `${p.algorithm}:${p.target}`).toBeTypeOf('function');
    }
  });

  it('sentences are one plain sentence, sentence case, no colon inside the input clause', () => {
    for (const p of pairs) {
      const t = targetFor(p.algorithm, p.kind);
      expect(t?.has).not.toMatch(/[:.]$/);
      expect(t?.has).not.toContain(':');
      const s = targetSentence(p.algorithm, p.kind) ?? '';
      expect(s).toMatch(/^[A-Z][^.]*\.$/);
      expect(s).toContain(`: recently you stumbled most on ${KIND_STUMBLE[p.kind]}.`);
    }
    expect(targetSentence('dijkstra', 'stale')).toBe(
      'This graph has a stale entry that pops, because a distance improves after it was pushed: recently you stumbled most on stale entries.',
    );
  });

  it('lookups return null for unmapped kinds and unknown algorithms', () => {
    expect(targetFor('dijkstra', 'unclassified')).toBeNull();
    expect(targetFor('dijkstra', 'boundary')).toBeNull();
    expect(targetFor('nope', 'stale')).toBeNull();
    expect(targetSentence('bst', 'stale')).toBeNull();
    expect(targetedKinds('dijkstra').sort()).toEqual(['comparison', 'dependency', 'order', 'stale']);
    expect(targetFor('dijkstra', 'order')?.target).toBe('stale');
    expect(targetedKinds('nope')).toEqual([]);
  });
});

describe.each(pairs)('$algorithm + $kind → $target', ({ algorithm, kind, target }) => {
  it(`randomInput(rng, '${target}') is valid, has the case, and the trace can produce a ${kind} mistake`, async () => {
    const m = await load(algorithm);
    const check = CASE_CHECKS[`${algorithm}:${target}`];
    if (!check) throw new Error('missing case check');
    for (let s = 0; s < SEEDS; s++) {
      const input = m.randomInput(createRng(`targets:${algorithm}:${kind}:${s}`), target);
      const encoded = m.encode(input);
      const v = m.validate(encoded);
      expect(v.ok, `${algorithm} ${target} seed ${s}: ${JSON.stringify(encoded)}`).toBe(true);
      expect(m.decode(encoded)).toEqual(input);
      const steps = [...m.generate(input)];
      expect(check(input, steps), `${algorithm} ${target} seed ${s}: ${JSON.stringify(encoded)}`).toBe(true);
      const kinds = new Set(steps.flatMap((st) => (st.ask ? st.ask.distractors.map((d) => d.kind) : [])));
      expect(kinds.has(kind), `${algorithm} ${target} seed ${s}: asks carry ${[...kinds].join(', ')}`).toBe(true);
    }
  });
});
