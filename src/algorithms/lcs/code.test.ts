import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { CodeListing } from '@/algorithms/types';
import { createRng } from '@/lib/rng';
import type { LcsInput, LcsResult } from './index';
import { lcs, reference } from './index';
import { detect, runCpp, runJava, runPython } from './native';

const native = detect();

function listing(lang: 'js' | 'python' | 'cpp' | 'java'): CodeListing {
  const l = lcs.code?.['bottomup']?.[lang];
  if (!l) throw new Error(`no ${lang} listing`);
  return l;
}

const word = (alphabet: string) => fc.array(fc.constantFrom(...alphabet.split('')), { maxLength: 7 }).map((xs) => xs.join(''));
const arb: fc.Arbitrary<LcsInput> = fc.constantFrom('AB', 'ABC', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').chain((alpha) => fc.record({ a: word(alpha), b: word(alpha) }));

/** ≥ 100 inputs for the compiled languages: presets, edge cases, random ones. */
function nativeInputs(): LcsInput[] {
  const out: LcsInput[] = lcs.presets.map((p) => p.input);
  out.push({ a: '', b: '' }, { a: 'AAAAAAA', b: 'ABBBBBB' }, { a: 'ABCDEFG', b: 'GFEDCBA' });
  for (let i = 0; i < 60; i++) out.push(lcs.randomInput(createRng(`code-${i}`)));
  out.push(...fc.sample(arb, { numRuns: 60, seed: 11 }));
  return out;
}

// Empty strings travel as "-" so every line has two tokens.
const stdin = (inputs: LcsInput[]): string => [String(inputs.length), ...inputs.map((x) => `${x.a || '-'} ${x.b || '-'}`)].join('\n') + '\n';
const format = (r: LcsResult): string => `${r.length} ${r.lcs || '-'}`;
const expected = (inputs: LcsInput[]): string[] => inputs.map((x) => format(reference(x)));
const lines = (out: string): string[] => out.trim().split('\n').map((l) => l.trim());

describe('lcs code listings', () => {
  it('every language maps every pseudocode line to real, non-blank lines', () => {
    const pseudo = lcs.pseudocode['bottomup'] as string[];
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
    const fn = new Function(`${listing('js').lines.join('\n')}\nreturn lcs;`)() as (a: string, b: string) => LcsResult;
    fc.assert(
      fc.property(arb, (input) => {
        expect(fn(input.a, input.b)).toEqual(reference(input));
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
      'out = []',
      'for k in range(int(data[0])):',
      "    a = data[1 + 2 * k].replace('-', '')",
      "    b = data[2 + 2 * k].replace('-', '')",
      '    length, s = lcs(a, b)',
      "    out.append(f\"{length} {s or '-'}\")",
      "print('\\n'.join(out))",
    ].join('\n');
    expect(lines(runPython(native, 'lcs/python', src, stdin(inputs)))).toEqual(expected(inputs));
  });

  it.skipIf(!native.cxx)('the C++ listing matches the reference on 100+ inputs', () => {
    const inputs = nativeInputs();
    const src = [
      '#include <algorithm>',
      '#include <iostream>',
      '#include <string>',
      '#include <vector>',
      '',
      ...listing('cpp').lines,
      '',
      'int main() {',
      '    int t; std::cin >> t;',
      '    while (t--) {',
      '        std::string a, b; std::cin >> a >> b;',
      '        if (a == "-") a = "";',
      '        if (b == "-") b = "";',
      '        std::string s = lcs(a, b);',
      '        std::cout << s.size() << " " << (s.empty() ? "-" : s) << "\\n";',
      '    }',
      '}',
    ].join('\n');
    expect(lines(runCpp(native, 'lcs/cpp', src, stdin(inputs)))).toEqual(expected(inputs));
  }, 60_000);

  it.skipIf(!native.java)('the Java listing matches the reference on 100+ inputs', () => {
    const inputs = nativeInputs();
    const src = [
      'import java.util.*;',
      '',
      'public class Main {',
      ...listing('java').lines.map((l) => `    ${l}`),
      '',
      '    public static void main(String[] args) {',
      '        Scanner in = new Scanner(System.in);',
      '        int t = in.nextInt();',
      '        StringBuilder out = new StringBuilder();',
      '        while (t-- > 0) {',
      '            String a = in.next(), b = in.next();',
      '            if (a.equals("-")) a = "";',
      '            if (b.equals("-")) b = "";',
      '            String s = lcs(a, b);',
      '            out.append(s.length()).append(" ").append(s.isEmpty() ? "-" : s).append("\\n");',
      '        }',
      '        System.out.print(out);',
      '    }',
      '}',
    ].join('\n');
    expect(lines(runJava(native, 'lcs/java', src, stdin(inputs)))).toEqual(expected(inputs));
  }, 60_000);

  it('reports which toolchains ran', () => {
    const missing = [!native.python && 'python3', !native.cxx && 'c++/clang++', !native.java && 'javac/java'].filter(Boolean);
    if (missing.length > 0) console.warn(`lcs code listings: skipped, not installed: ${missing.join(', ')}`);
    expect(nativeInputs().length).toBeGreaterThanOrEqual(100);
  });
});
