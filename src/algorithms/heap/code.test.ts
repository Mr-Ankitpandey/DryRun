/** The heap listings: line maps fit the pseudocode, and every language runs
 *  against `reference` (final heap array and the extracted value). JS runs here
 *  on 300+ inputs per operation; Python, C++ and Java run once each on 100+
 *  inputs per operation through one program per language (all three
 *  operations' listings together), built and run inside ./.scratch/r4/code. */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { detect, runCpp, runJava, runPython } from '@/algorithms/_code/native';
import { checkListing } from '@/algorithms/_code/validate';
import type { CodeListing, RealLanguage } from '@/algorithms/types';
import { createRng } from '@/lib/rng';
import type { HeapInput, HeapOp } from './index';
import { heap, reference } from './index';
import { heapify } from './model';

const native = detect();
const OPS: HeapOp[] = ['insert', 'extract', 'build'];
const OP_CODE: Record<HeapOp, number> = { insert: 0, extract: 1, build: 2 };

function listing(op: HeapOp, lang: RealLanguage): CodeListing {
  const l = heap.code?.[op]?.[lang];
  if (!l) throw new Error(`no ${op}/${lang} listing`);
  return l;
}

const value = fc.integer({ min: 0, max: 99 });
const small = fc.integer({ min: 0, max: 5 });
const arbFor = (op: HeapOp): fc.Arbitrary<HeapInput> =>
  fc.record({
    a: fc.array(fc.oneof(value, small), { maxLength: op === 'insert' ? 14 : 15 }).map((a) => (op === 'build' ? a : heapify(a))),
    op: fc.constant(op),
    x: op === 'insert' ? fc.oneof(value, small) : fc.constant(0),
  });

/** Presets of the op, edge cases, targeted random inputs and fast-check samples. */
function inputs(op: HeapOp, count: number): HeapInput[] {
  const out: HeapInput[] = heap.presets.map((p) => p.input).filter((i) => i.op === op);
  out.push({ a: [], op, x: 7 }, { a: [3], op, x: 1 }, { a: [3], op, x: 3 });
  for (let i = 0; out.length < count / 2; i++) {
    const input = heap.randomInput(createRng(`code-${op}-${i}`), i % 3 === 0 ? 'ties' : op);
    if (input.op === op) out.push(input);
  }
  out.push(...fc.sample(arbFor(op), { numRuns: count - out.length, seed: 41 }));
  return out.filter((i) => heap.validate(heap.encode(i)).ok);
}

const format = (input: HeapInput): string => {
  const r = reference(input);
  return `${r.heap.join(' ')} | ${r.extracted ?? -1}`.trim();
};
const tokens = (input: HeapInput): string => [OP_CODE[input.op], input.a.length, ...input.a, input.x].join(' ');
const stdin = (all: HeapInput[]): string => `${all.length}\n${all.map(tokens).join('\n')}\n`;
const lines = (out: string): string[] => out.trim().split('\n').map((l) => l.trim());
const NATIVE = (): HeapInput[] => OPS.flatMap((op) => inputs(op, 110));

describe('heap code listings', () => {
  for (const op of OPS) {
    it(`${op}: every language maps every pseudocode line to real, non-blank lines`, () => {
      const pseudo = heap.pseudocode[op] as string[];
      for (const lang of ['js', 'python', 'cpp', 'java'] as const) {
        const l = listing(op, lang);
        const { problems, empty } = checkListing(pseudo, l);
        expect(problems, `${op}/${lang}`).toEqual([]);
        expect(empty, `${op}/${lang}`).toEqual([]);
        for (const targets of l.map) for (const t of targets) expect((l.lines[t - 1] as string).trim()).not.toBe('');
      }
    });

    it(`${op}: the JavaScript listing runs and matches the reference on 300+ inputs`, () => {
      const fns = new Function(`${listing(op, 'js').lines.join('\n')}\nreturn { insert: typeof insert === 'function' ? insert : null, extractMin: typeof extractMin === 'function' ? extractMin : null, buildHeap: typeof buildHeap === 'function' ? buildHeap : null };`)() as {
        insert: ((a: number[], x: number) => void) | null;
        extractMin: ((a: number[]) => number | null) | null;
        buildHeap: ((a: number[]) => void) | null;
      };
      const all = [...inputs(op, 120), ...fc.sample(arbFor(op), { numRuns: 200, seed: 5 })];
      expect(all.length).toBeGreaterThanOrEqual(300);
      for (const input of all) {
        const a = [...input.a];
        let m: number | null = null;
        if (op === 'insert') fns.insert?.(a, input.x);
        else if (op === 'extract') m = fns.extractMin?.(a) ?? null;
        else fns.buildHeap?.(a);
        expect(`${a.join(' ')} | ${m ?? -1}`.trim(), JSON.stringify(input)).toBe(format(input));
      }
    });
  }

  it.skipIf(!native.python)('the Python listings match the reference on 100+ inputs per operation', () => {
    const all = NATIVE();
    const src = [
      'import sys',
      '',
      ...listing('insert', 'python').lines,
      '',
      ...listing('extract', 'python').lines,
      '',
      ...listing('build', 'python').lines,
      '',
      'data = sys.stdin.read().split()',
      'pos = 0',
      'def nxt():',
      '    global pos',
      '    pos += 1',
      '    return int(data[pos - 1])',
      'out = []',
      'for _ in range(nxt()):',
      '    op, n = nxt(), nxt()',
      '    a = [nxt() for _ in range(n)]',
      '    x = nxt()',
      '    m = -1',
      '    if op == 0:',
      '        insert(a, x)',
      '    elif op == 1:',
      '        r = extract_min(a)',
      '        m = -1 if r is None else r',
      '    else:',
      '        build_heap(a)',
      "    out.append((' '.join(map(str, a)) + ' | ' + str(m)).strip())",
      "print('\\n'.join(out))",
    ].join('\n');
    expect(lines(runPython(native, 'heap/python', src, stdin(all)))).toEqual(all.map(format));
  });

  it.skipIf(!native.cxx)('the C++ listings match the reference on 100+ inputs per operation', () => {
    const all = NATIVE();
    const src = [
      '#include <iostream>',
      '#include <utility>',
      '#include <vector>',
      'using namespace std;',
      '',
      ...listing('insert', 'cpp').lines,
      '',
      ...listing('extract', 'cpp').lines,
      '',
      ...listing('build', 'cpp').lines,
      '',
      'int main() {',
      '    int t; cin >> t;',
      '    while (t--) {',
      '        int op, n; cin >> op >> n;',
      '        vector<int> a(n);',
      '        for (auto& e : a) cin >> e;',
      '        int x; cin >> x;',
      '        int m = -1;',
      '        if (op == 0) insert(a, x);',
      '        else if (op == 1) m = extractMin(a);',
      '        else buildHeap(a);',
      '        for (size_t i = 0; i < a.size(); i++) cout << (i ? " " : "") << a[i];',
      '        cout << " | " << m << "\\n";',
      '    }',
      '}',
    ].join('\n');
    expect(lines(runCpp(native, 'heap/cpp', src, stdin(all)))).toEqual(all.map(format));
  }, 60_000);

  it.skipIf(!native.java)('the Java listings match the reference on 100+ inputs per operation', () => {
    const all = NATIVE();
    const indent = (ls: readonly string[]) => ls.map((l) => (l === '' ? l : `    ${l}`));
    const src = [
      'import java.util.*;',
      '',
      'public class Main {',
      ...indent(listing('insert', 'java').lines),
      '',
      ...indent(listing('extract', 'java').lines),
      '',
      ...indent(listing('build', 'java').lines),
      '',
      '    public static void main(String[] args) {',
      '        Scanner in = new Scanner(System.in);',
      '        int t = in.nextInt();',
      '        StringBuilder out = new StringBuilder();',
      '        while (t-- > 0) {',
      '            int op = in.nextInt(), n = in.nextInt();',
      '            List<Integer> a = new ArrayList<>();',
      '            for (int k = 0; k < n; k++) a.add(in.nextInt());',
      '            int x = in.nextInt();',
      '            int m = -1;',
      '            if (op == 0) insert(a, x);',
      '            else if (op == 1) m = extractMin(a);',
      '            else buildHeap(a);',
      '            StringBuilder line = new StringBuilder();',
      '            for (int k = 0; k < a.size(); k++) line.append(k > 0 ? " " : "").append(a.get(k));',
      '            line.append(" | ").append(m);',
      '            out.append(line.toString().trim()).append("\\n");',
      '        }',
      '        System.out.print(out);',
      '    }',
      '}',
    ].join('\n');
    expect(lines(runJava(native, 'heap/java', src, stdin(all)))).toEqual(all.map(format));
  }, 60_000);

  it('reports which toolchains ran, and the native input count', () => {
    const missing = [!native.python && 'python3', !native.cxx && 'c++/clang++', !native.java && 'javac/java'].filter(Boolean);
    if (missing.length > 0) console.warn(`heap code listings: skipped, not installed: ${missing.join(', ')}`);
    for (const op of OPS) expect(inputs(op, 110).length, op).toBeGreaterThanOrEqual(100);
  });
});
