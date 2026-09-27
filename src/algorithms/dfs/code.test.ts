import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { CodeListing } from '@/algorithms/types';
import { createRng } from '@/lib/rng';
import type { DfsInput, DfsTimes } from './index';
import { dfs, reference } from './index';
import { detect, runCpp, runJava, runPython } from './native';

const native = detect();

function listing(lang: 'js' | 'python' | 'cpp' | 'java'): CodeListing {
  const l = dfs.code?.['recursive']?.[lang];
  if (!l) throw new Error(`no ${lang} listing`);
  return l;
}

const arb: fc.Arbitrary<DfsInput> = fc.integer({ min: 1, max: 10 }).chain((n) => {
  const edge = fc
    .record({ a: fc.integer({ min: 0, max: n - 1 }), b: fc.integer({ min: 0, max: n - 1 }) })
    .filter((e) => e.a !== e.b)
    .map((e) => (e.a < e.b ? e : { a: e.b, b: e.a }));
  return fc.record({
    n: fc.constant(n),
    edges: n < 2 ? fc.constant([]) : fc.uniqueArray(edge, { maxLength: Math.min(16, (n * (n - 1)) / 2), selector: (e) => `${e.a}-${e.b}` }),
  });
});

/** ≥ 100 inputs for the compiled languages: presets, edge cases, random ones. */
function nativeInputs(): DfsInput[] {
  const out: DfsInput[] = dfs.presets.map((p) => p.input);
  out.push({ n: 1, edges: [] }, { n: 10, edges: [] });
  for (let i = 0; i < 60; i++) out.push(dfs.randomInput(createRng(`code-${i}`)));
  out.push(...fc.sample(arb, { numRuns: 60, seed: 7 }));
  return out;
}

const stdin = (inputs: DfsInput[]): string =>
  [String(inputs.length), ...inputs.map((x) => [`${x.n} ${x.edges.length}`, ...x.edges.map((e) => `${e.a} ${e.b}`)].join('\n'))].join('\n') + '\n';
const expected = (inputs: DfsInput[]): string[] => inputs.map((x) => format(reference(x)));
const format = (t: DfsTimes): string => `${t.d.join(' ')} | ${t.f.join(' ')}`;
const lines = (out: string): string[] => out.trim().split('\n').map((l) => l.trim());

describe('dfs code listings', () => {
  it('every language maps every pseudocode line to real, non-blank lines', () => {
    const pseudo = dfs.pseudocode['recursive'] as string[];
    for (const lang of ['js', 'python', 'cpp', 'java'] as const) {
      const l = listing(lang);
      expect(l.map, lang).toHaveLength(pseudo.length);
      l.map.forEach((targets, p) => {
        expect(targets.length, `${lang} pseudocode line ${p + 1}`).toBeGreaterThan(0);
        for (const t of targets) {
          expect(Number.isInteger(t) && t >= 1 && t <= l.lines.length, `${lang} line ${t}`).toBe(true);
          expect((l.lines[t - 1] as string).trim(), `${lang} line ${t}`).not.toBe('');
        }
      });
      for (const text of l.lines) expect(text).not.toMatch(/\t/);
    }
  });

  it('the JavaScript listing runs and matches the reference on 300 random inputs', () => {
    const fn = new Function(`${listing('js').lines.join('\n')}\nreturn dfsTimes;`)() as (n: number, edges: number[][]) => DfsTimes;
    fc.assert(
      fc.property(arb, (input) => {
        expect(fn(input.n, input.edges.map((e) => [e.a, e.b]))).toEqual(reference(input));
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
      '    edges = []',
      '    for _ in range(m):',
      '        edges.append((int(data[pos]), int(data[pos + 1])))',
      '        pos += 2',
      '    d, f = dfs_times(n, edges)',
      "    out.append(' '.join(map(str, d)) + ' | ' + ' '.join(map(str, f)))",
      "print('\\n'.join(out))",
    ].join('\n');
    expect(lines(runPython(native, 'dfs/python', src, stdin(inputs)))).toEqual(expected(inputs));
  });

  it.skipIf(!native.cxx)('the C++ listing matches the reference on 100+ inputs', () => {
    const inputs = nativeInputs();
    const src = [
      '#include <algorithm>',
      '#include <iostream>',
      '#include <utility>',
      '#include <vector>',
      '',
      ...listing('cpp').lines,
      '',
      'int main() {',
      '    int t; std::cin >> t;',
      '    while (t--) {',
      '        int n, m; std::cin >> n >> m;',
      '        std::vector<std::pair<int, int>> edges(m);',
      '        for (auto& e : edges) std::cin >> e.first >> e.second;',
      '        DfsTimes r(n, edges);',
      '        for (int v = 0; v < n; v++) std::cout << (v ? " " : "") << r.d[v];',
      '        std::cout << " |";',
      '        for (int v = 0; v < n; v++) std::cout << " " << r.f[v];',
      '        std::cout << "\\n";',
      '    }',
      '}',
    ].join('\n');
    expect(lines(runCpp(native, 'dfs/cpp', src, stdin(inputs)))).toEqual(expected(inputs));
  }, 60_000);

  it.skipIf(!native.java)('the Java listing matches the reference on 100+ inputs', () => {
    const inputs = nativeInputs();
    const src = [
      'import java.util.*;',
      '',
      ...listing('java').lines,
      '',
      'public class Main {',
      '    public static void main(String[] args) {',
      '        Scanner in = new Scanner(System.in);',
      '        int t = in.nextInt();',
      '        StringBuilder out = new StringBuilder();',
      '        while (t-- > 0) {',
      '            int n = in.nextInt(), m = in.nextInt();',
      '            int[][] edges = new int[m][2];',
      '            for (int[] e : edges) { e[0] = in.nextInt(); e[1] = in.nextInt(); }',
      '            DfsTimes r = new DfsTimes(n, edges);',
      '            for (int v = 0; v < n; v++) out.append(v > 0 ? " " : "").append(r.d[v]);',
      '            out.append(" |");',
      '            for (int v = 0; v < n; v++) out.append(" ").append(r.f[v]);',
      '            out.append("\\n");',
      '        }',
      '        System.out.print(out);',
      '    }',
      '}',
    ].join('\n');
    expect(lines(runJava(native, 'dfs/java', src, stdin(inputs)))).toEqual(expected(inputs));
  }, 60_000);

  it('reports which toolchains ran', () => {
    const missing = [!native.python && 'python3', !native.cxx && 'c++/clang++', !native.java && 'javac/java'].filter(Boolean);
    if (missing.length > 0) console.warn(`dfs code listings: skipped, not installed: ${missing.join(', ')}`);
    expect(nativeInputs().length).toBeGreaterThanOrEqual(100);
  });
});
