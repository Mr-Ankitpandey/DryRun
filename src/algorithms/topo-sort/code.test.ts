/** The topological-sort listings: line maps fit the pseudocode, and every
 *  language runs against `reference` (the output order). JS runs here on 300+
 *  random DAGs; Python, C++ and Java run on 100+ inputs each, built and run
 *  inside ./.scratch/r4/code. */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { detect, runCpp, runJava, runPython } from '@/algorithms/_code/native';
import { checkListing } from '@/algorithms/_code/validate';
import type { CodeListing, RealLanguage } from '@/algorithms/types';
import { createRng } from '@/lib/rng';
import type { TopoInput } from './index';
import { reference, topoSort } from './index';

const native = detect();

function listing(lang: RealLanguage): CodeListing {
  const l = topoSort.code?.['kahn']?.[lang];
  if (!l) throw new Error(`no ${lang} listing`);
  return l;
}

const arb: fc.Arbitrary<TopoInput> = fc.integer({ min: 1, max: 10 }).chain((n) =>
  fc.tuple(fc.shuffledSubarray(Array.from({ length: n }, (_, i) => i), { minLength: n, maxLength: n }), fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1)), { maxLength: 30 })).map(([perm, raw]) => {
    const rank = new Map(perm.map((v, i) => [v, i]));
    const seen = new Set<string>();
    const arcs: { a: number; b: number }[] = [];
    for (const [x, y] of raw) {
      if (x === y) continue;
      const [a, b] = (rank.get(x) as number) < (rank.get(y) as number) ? [x, y] : [y, x];
      if (seen.has(`${a}>${b}`) || arcs.length >= 16) continue;
      seen.add(`${a}>${b}`);
      arcs.push({ a, b });
    }
    return { n, arcs };
  }),
);

function nativeInputs(): TopoInput[] {
  const out: TopoInput[] = topoSort.presets.map((p) => p.input);
  out.push({ n: 10, arcs: [] }, { n: 2, arcs: [{ a: 1, b: 0 }] });
  for (let i = 0; i < 60; i++) out.push(topoSort.randomInput(createRng(`code-${i}`), i % 2 ? 'wide' : 'multi-parent'));
  out.push(...fc.sample(arb, { numRuns: 60, seed: 9 }));
  return out;
}

const stdin = (inputs: TopoInput[]): string => [String(inputs.length), ...inputs.map((x) => [`${x.n} ${x.arcs.length}`, ...x.arcs.map((e) => `${e.a} ${e.b}`)].join('\n'))].join('\n') + '\n';
const expected = (inputs: TopoInput[]): string[] => inputs.map((x) => reference(x).join(' '));
const lines = (out: string): string[] => out.trim().split('\n').map((l) => l.trim());

describe('topological sort code listings', () => {
  it('every language maps every pseudocode line to real, non-blank lines', () => {
    const pseudo = topoSort.pseudocode['kahn'] as string[];
    for (const lang of ['js', 'python', 'cpp', 'java'] as const) {
      const l = listing(lang);
      const { problems, empty } = checkListing(pseudo, l);
      expect(problems, lang).toEqual([]);
      expect(empty, lang).toEqual([]);
      for (const targets of l.map) for (const t of targets) expect((l.lines[t - 1] as string).trim()).not.toBe('');
    }
  });

  it('the JavaScript listing runs and matches the reference on 300 random DAGs and every preset', () => {
    const fn = new Function(`${listing('js').lines.join('\n')}\nreturn topoSort;`)() as (n: number, arcs: number[][]) => number[];
    for (const p of topoSort.presets) expect(fn(p.input.n, p.input.arcs.map((e) => [e.a, e.b]))).toEqual(reference(p.input));
    fc.assert(
      fc.property(arb, (input) => {
        expect(fn(input.n, input.arcs.map((e) => [e.a, e.b]))).toEqual(reference(input));
      }),
      { numRuns: 300 },
    );
  });

  it.skipIf(!native.python)('the Python listing matches the reference on 100+ inputs', () => {
    const inputs = nativeInputs();
    const src = [
      'import sys',
      'from collections import deque',
      '',
      ...listing('python').lines,
      '',
      'data = sys.stdin.read().split()',
      'pos = 1',
      'out = []',
      'for _ in range(int(data[0])):',
      '    n, m = int(data[pos]), int(data[pos + 1])',
      '    pos += 2',
      '    arcs = []',
      '    for _ in range(m):',
      '        arcs.append((int(data[pos]), int(data[pos + 1])))',
      '        pos += 2',
      "    out.append(' '.join(map(str, topo_sort(n, arcs))))",
      "print('\\n'.join(out))",
    ].join('\n');
    expect(lines(runPython(native, 'topo-sort/python', src, stdin(inputs)))).toEqual(expected(inputs));
  });

  it.skipIf(!native.cxx)('the C++ listing matches the reference on 100+ inputs', () => {
    const inputs = nativeInputs();
    const src = [
      '#include <algorithm>',
      '#include <iostream>',
      '#include <queue>',
      '#include <utility>',
      '#include <vector>',
      'using namespace std;',
      '',
      ...listing('cpp').lines,
      '',
      'int main() {',
      '    int t; cin >> t;',
      '    while (t--) {',
      '        int n, m; cin >> n >> m;',
      '        vector<pair<int, int>> arcs(m);',
      '        for (auto& e : arcs) cin >> e.first >> e.second;',
      '        vector<int> order = topoSort(n, arcs);',
      '        for (size_t i = 0; i < order.size(); i++) cout << (i ? " " : "") << order[i];',
      '        cout << "\\n";',
      '    }',
      '}',
    ].join('\n');
    expect(lines(runCpp(native, 'topo-sort/cpp', src, stdin(inputs)))).toEqual(expected(inputs));
  }, 60_000);

  it.skipIf(!native.java)('the Java listing matches the reference on 100+ inputs', () => {
    const inputs = nativeInputs();
    const src = [
      'import java.util.*;',
      '',
      'public class Main {',
      ...listing('java').lines.map((l) => (l === '' ? l : `    ${l}`)),
      '',
      '    public static void main(String[] args) {',
      '        Scanner in = new Scanner(System.in);',
      '        int t = in.nextInt();',
      '        StringBuilder out = new StringBuilder();',
      '        while (t-- > 0) {',
      '            int n = in.nextInt(), m = in.nextInt();',
      '            int[][] arcs = new int[m][2];',
      '            for (int[] e : arcs) { e[0] = in.nextInt(); e[1] = in.nextInt(); }',
      '            List<Integer> order = topoSort(n, arcs);',
      '            for (int i = 0; i < order.size(); i++) out.append(i > 0 ? " " : "").append(order.get(i));',
      '            out.append("\\n");',
      '        }',
      '        System.out.print(out);',
      '    }',
      '}',
    ].join('\n');
    expect(lines(runJava(native, 'topo-sort/java', src, stdin(inputs)))).toEqual(expected(inputs));
  }, 60_000);

  it('reports which toolchains ran', () => {
    const missing = [!native.python && 'python3', !native.cxx && 'c++/clang++', !native.java && 'javac/java'].filter(Boolean);
    if (missing.length > 0) console.warn(`topo-sort code listings: skipped, not installed: ${missing.join(', ')}`);
    expect(nativeInputs().length).toBeGreaterThanOrEqual(100);
  });
});
