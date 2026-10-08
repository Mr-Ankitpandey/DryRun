/** The union-find listings: line maps fit the pseudocode, and every language
 *  runs the operation list against `reference` (parent[], the rank of every
 *  root and every standalone find's result). JS runs here on 300+ inputs;
 *  Python, C++ and Java on 100+ each, built and run inside ./.scratch/r4/code. */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { detect, runCpp, runJava, runPython } from '@/algorithms/_code/native';
import { checkListing } from '@/algorithms/_code/validate';
import type { CodeListing, RealLanguage } from '@/algorithms/types';
import { createRng } from '@/lib/rng';
import type { UfInput } from './index';
import { reference, unionFind } from './index';

const native = detect();

function listing(lang: RealLanguage): CodeListing {
  const l = unionFind.code?.['rank']?.[lang];
  if (!l) throw new Error(`no ${lang} listing`);
  return l;
}

const arb: fc.Arbitrary<UfInput> = fc.integer({ min: 1, max: 10 }).chain((n) =>
  fc.record({
    n: fc.constant(n),
    ops: fc.array(
      fc.oneof(
        { weight: 3, arbitrary: fc.record({ t: fc.constant('u' as const), a: fc.nat(n - 1), b: fc.nat(n - 1) }) },
        { weight: 1, arbitrary: fc.record({ t: fc.constant('f' as const), x: fc.nat(n - 1) }) },
      ),
      { minLength: 1, maxLength: 12 },
    ),
  }),
);

/** parent[] | rank of each root (non-roots −1) | finds. */
function format(parent: readonly number[], rank: readonly number[], finds: readonly number[]): string {
  const roots = rank.map((r, v) => (parent[v] === v ? r : -1));
  return `${parent.join(' ')} | ${roots.join(' ')} | ${finds.join(' ')}`.trim();
}
const expected = (inputs: UfInput[]): string[] =>
  inputs.map((x) => {
    const r = reference(x);
    return format(r.parent, r.rank.map((k) => k ?? -1), r.finds);
  });

function nativeInputs(): UfInput[] {
  const out: UfInput[] = unionFind.presets.map((p) => p.input);
  for (let i = 0; i < 60; i++) out.push(unionFind.randomInput(createRng(`code-${i}`), ['compress', 'same-set', 'tie'][i % 3]));
  out.push(...fc.sample(arb, { numRuns: 60, seed: 23 }));
  return out;
}

const stdin = (inputs: UfInput[]): string =>
  [String(inputs.length), ...inputs.map((x) => [`${x.n} ${x.ops.length}`, ...x.ops.map((o) => (o.t === 'u' ? `0 ${o.a} ${o.b}` : `1 ${o.x} 0`))].join('\n'))].join('\n') + '\n';
const lines = (out: string): string[] => out.trim().split('\n').map((l) => l.trim());

describe('union-find code listings', () => {
  it('every language maps every pseudocode line to real, non-blank lines', () => {
    const pseudo = unionFind.pseudocode['rank'] as string[];
    for (const lang of ['js', 'python', 'cpp', 'java'] as const) {
      const l = listing(lang);
      const { problems, empty } = checkListing(pseudo, l);
      expect(problems, lang).toEqual([]);
      expect(empty, lang).toEqual([]);
      for (const targets of l.map) for (const t of targets) expect((l.lines[t - 1] as string).trim()).not.toBe('');
    }
  });

  it('the JavaScript listing runs and matches the reference on 300 random inputs and every preset', () => {
    const fns = new Function(`${listing('js').lines.join('\n')}\nreturn { find, union };`)() as {
      find: (parent: number[], x: number) => number;
      union: (parent: number[], rank: number[], a: number, b: number) => void;
    };
    const runJs = (input: UfInput): string => {
      const parent = Array.from({ length: input.n }, (_, i) => i);
      const rank = Array.from({ length: input.n }, () => 0);
      const finds: number[] = [];
      for (const o of input.ops) {
        if (o.t === 'u') fns.union(parent, rank, o.a, o.b);
        else finds.push(fns.find(parent, o.x));
      }
      return format(parent, rank, finds);
    };
    for (const p of unionFind.presets) expect(runJs(p.input)).toEqual(expected([p.input])[0]);
    fc.assert(
      fc.property(arb, (input) => {
        expect(runJs(input)).toEqual(expected([input])[0]);
      }),
      { numRuns: 300 },
    );
  });

  it.skipIf(!native.python)('the Python listing matches the reference on 100+ inputs', () => {
    const inputs = nativeInputs();
    const src = [
      'import sys',
      '',
      ...listing('python').lines,
      '',
      'data = sys.stdin.read().split()',
      'pos = 1',
      'out = []',
      'for _ in range(int(data[0])):',
      '    n, m = int(data[pos]), int(data[pos + 1])',
      '    pos += 2',
      '    parent = list(range(n))',
      '    rank = [0] * n',
      '    finds = []',
      '    for _ in range(m):',
      '        k, a, b = int(data[pos]), int(data[pos + 1]), int(data[pos + 2])',
      '        pos += 3',
      '        if k == 0:',
      '            union(parent, rank, a, b)',
      '        else:',
      '            finds.append(find(parent, a))',
      '    roots = [rank[v] if parent[v] == v else -1 for v in range(n)]',
      "    out.append((' '.join(map(str, parent)) + ' | ' + ' '.join(map(str, roots)) + ' | ' + ' '.join(map(str, finds))).strip())",
      "print('\\n'.join(out))",
    ].join('\n');
    expect(lines(runPython(native, 'union-find/python', src, stdin(inputs)))).toEqual(expected(inputs));
  });

  it.skipIf(!native.cxx)('the C++ listing matches the reference on 100+ inputs', () => {
    const inputs = nativeInputs();
    const src = [
      '#include <iostream>',
      '#include <sstream>',
      '#include <string>',
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
      '        vector<int> parent(n), rank(n, 0), finds;',
      '        for (int v = 0; v < n; v++) parent[v] = v;',
      '        for (int i = 0; i < m; i++) {',
      '            int k, a, b; cin >> k >> a >> b;',
      '            if (k == 0) unite(parent, rank, a, b);',
      '            else finds.push_back(find(parent, a));',
      '        }',
      '        ostringstream line;',
      '        for (int v = 0; v < n; v++) line << (v ? " " : "") << parent[v];',
      '        line << " |";',
      '        for (int v = 0; v < n; v++) line << " " << (parent[v] == v ? rank[v] : -1);',
      '        line << " |";',
      '        for (int f : finds) line << " " << f;',
      '        string s = line.str();',
      '        while (!s.empty() && s.back() == \' \') s.pop_back();',
      '        cout << s << "\\n";',
      '    }',
      '}',
    ].join('\n');
    expect(lines(runCpp(native, 'union-find/cpp', src, stdin(inputs)))).toEqual(expected(inputs));
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
      '            int[] parent = new int[n], rank = new int[n];',
      '            for (int v = 0; v < n; v++) parent[v] = v;',
      '            List<Integer> finds = new ArrayList<>();',
      '            for (int i = 0; i < m; i++) {',
      '                int k = in.nextInt(), a = in.nextInt(), b = in.nextInt();',
      '                if (k == 0) union(parent, rank, a, b);',
      '                else finds.add(find(parent, a));',
      '            }',
      '            StringBuilder line = new StringBuilder();',
      '            for (int v = 0; v < n; v++) line.append(v > 0 ? " " : "").append(parent[v]);',
      '            line.append(" |");',
      '            for (int v = 0; v < n; v++) line.append(" ").append(parent[v] == v ? rank[v] : -1);',
      '            line.append(" |");',
      '            for (int f : finds) line.append(" ").append(f);',
      '            out.append(line.toString().trim()).append("\\n");',
      '        }',
      '        System.out.print(out);',
      '    }',
      '}',
    ].join('\n');
    expect(lines(runJava(native, 'union-find/java', src, stdin(inputs)))).toEqual(expected(inputs));
  }, 60_000);

  it('reports which toolchains ran', () => {
    const missing = [!native.python && 'python3', !native.cxx && 'c++/clang++', !native.java && 'javac/java'].filter(Boolean);
    if (missing.length > 0) console.warn(`union-find code listings: skipped, not installed: ${missing.join(', ')}`);
    expect(nativeInputs().length).toBeGreaterThanOrEqual(100);
  });
});
