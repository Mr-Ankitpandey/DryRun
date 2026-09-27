/** Runs Python / C++ / Java listings on this machine when the toolchain exists
 *  (tests only). Everything is written under ./.scratch/wp-j/: sources,
 *  binaries (cached by content hash) and the compilers' temp files (TMPDIR). */

import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtLang } from './cases';

export const SCRATCH = fileURLToPath(new URL('../../../.scratch/wp-j/', import.meta.url));
const BUILD = join(SCRATCH, 'build');
const TMP = join(SCRATCH, 'tmp');

function env(): NodeJS.ProcessEnv {
  mkdirSync(TMP, { recursive: true });
  return { ...process.env, TMPDIR: TMP, TMP, TEMP: TMP, PYTHONDONTWRITEBYTECODE: '1' };
}

function which(cmd: string): string | null {
  const r = spawnSync('which', [cmd], { encoding: 'utf8' });
  const out = r.status === 0 ? r.stdout.trim() : '';
  return out === '' ? null : out;
}

export interface Toolchain {
  ok: boolean;
  /** What was found, or why the language is skipped. */
  detail: string;
  cmd: Record<string, string>;
}

export function detectToolchains(): Record<ExtLang, Toolchain> {
  const py = which('python3');
  const cxx = which('c++') ?? which('clang++') ?? which('g++');
  const javac = which('javac');
  const java = which('java');
  return {
    python: py ? { ok: true, detail: py, cmd: { run: py } } : { ok: false, detail: 'python3 not found on PATH', cmd: {} },
    cpp: cxx ? { ok: true, detail: cxx, cmd: { cc: cxx } } : { ok: false, detail: 'no c++ / clang++ / g++ on PATH', cmd: {} },
    java: javac && java ? { ok: true, detail: `${javac} + ${java}`, cmd: { javac, java } } : { ok: false, detail: 'javac and java not both on PATH', cmd: {} },
  };
}

// ---------------------------------------------------------------------------
// program assembly

const indent = (text: string, pad: string): string =>
  text
    .split('\n')
    .map((l) => (l === '' ? l : pad + l))
    .join('\n');

const PY_PRELUDE = `import sys, heapq
from collections import deque
sys.setrecursionlimit(10000)

class Item:
    __slots__ = ('v', 'id')
    def __init__(self, v, id):
        self.v = v
        self.id = id
    def __lt__(self, o): return self.v < o.v
    def __le__(self, o): return self.v <= o.v
    def __gt__(self, o): return self.v > o.v
    def __ge__(self, o): return self.v >= o.v
`;

const CPP_PRELUDE = `#include <algorithm>
#include <climits>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <queue>
#include <utility>
#include <vector>
using namespace std;
`;

export function program(lang: ExtLang, listing: readonly string[], driver: { body: string; helpers?: string }): string {
  const src = listing.join('\n');
  const helpers = driver.helpers ?? '';
  if (lang === 'python') {
    return `${PY_PRELUDE}
${src}

${helpers}

_data = sys.stdin.read().split()
_pos = 0
def nxt():
    global _pos
    _pos += 1
    return int(_data[_pos - 1])
_out = []
def emit(xs):
    _out.append(' '.join(str(int(x)) for x in xs))
for _case in range(nxt()):
${indent(driver.body, '    ')}
print('\\n'.join(_out))
`;
  }
  if (lang === 'cpp') {
    return `${CPP_PRELUDE}
${src}

${helpers}

static int nxt() { int x; if (!(cin >> x)) exit(3); return x; }
static void emit(const vector<int>& v) {
    for (size_t i = 0; i < v.size(); i++) cout << (i ? " " : "") << v[i];
    cout << '\\n';
}

int main() {
    ios::sync_with_stdio(false);
    int T = nxt();
    while (T--) {
${indent(driver.body, '        ')}
    }
    return 0;
}
`;
  }
  return `import java.io.*;
import java.util.*;

public class Main {
${indent(src, '    ')}

${indent(helpers, '    ')}

    static StreamTokenizer in = new StreamTokenizer(new BufferedReader(new InputStreamReader(System.in)));
    static StringBuilder out = new StringBuilder();
    static int nxt() throws IOException { in.nextToken(); return (int) in.nval; }
    static void emit(int[] v) {
        for (int i = 0; i < v.length; i++) out.append(i > 0 ? " " : "").append(v[i]);
        out.append('\\n');
    }
    static void emit(List<Integer> v) {
        for (int i = 0; i < v.size(); i++) out.append(i > 0 ? " " : "").append(v.get(i));
        out.append('\\n');
    }

    public static void main(String[] args) throws IOException {
        int T = nxt();
        while (T-- > 0) {
${indent(driver.body, '            ')}
        }
        System.out.print(out);
    }
}
`;
}

// ---------------------------------------------------------------------------
// build and run

export interface Built {
  lang: ExtLang;
  dir: string;
  cached: boolean;
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, env: env(), maxBuffer: 16 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) reject(new Error(`${cmd} ${args.join(' ')} failed:\n${stderr}`));
      else resolve();
    });
  });
}

/** Writes and compiles the program once per content hash; later runs reuse it. */
export async function build(lang: ExtLang, source: string, tc: Toolchain): Promise<Built> {
  const hash = createHash('sha256').update(lang).update('\0').update(source).digest('hex').slice(0, 16);
  const dir = join(BUILD, `${lang}-${hash}`);
  const done = join(dir, 'ok');
  if (existsSync(done)) return { lang, dir, cached: true };
  // Build in a private directory, then move it into place (parallel test runs).
  const work = `${dir}.${process.pid}.${Date.now()}`;
  mkdirSync(work, { recursive: true });
  if (lang === 'python') {
    writeFileSync(join(work, 'main.py'), source);
  } else if (lang === 'cpp') {
    writeFileSync(join(work, 'main.cpp'), source);
    await run(tc.cmd.cc as string, ['-std=c++17', '-O1', '-w', '-o', 'main', 'main.cpp'], work);
  } else {
    writeFileSync(join(work, 'Main.java'), source);
    await run(tc.cmd.javac as string, ['-J-XX:-UsePerfData', `-J-Djava.io.tmpdir=${TMP}`, '-nowarn', '-d', '.', 'Main.java'], work);
  }
  writeFileSync(join(work, 'ok'), '');
  try {
    renameSync(work, dir);
  } catch {
    // Another run finished the same build first: use it.
    rmSync(work, { recursive: true, force: true });
  }
  return { lang, dir, cached: false };
}

/** Runs a built program on `cases` (one integer list each) and returns one integer list per case. */
export function execute(b: Built, tc: Toolchain, cases: readonly number[][]): number[][] {
  const stdin = `${cases.length}\n${cases.map((c) => c.join(' ')).join('\n')}\n`;
  let cmd: string;
  let args: string[];
  if (b.lang === 'python') [cmd, args] = [tc.cmd.run as string, ['-B', join(b.dir, 'main.py')]];
  else if (b.lang === 'cpp') [cmd, args] = [join(b.dir, 'main'), []];
  else [cmd, args] = [tc.cmd.java as string, ['-XX:-UsePerfData', `-Djava.io.tmpdir=${TMP}`, '-Xss16m', '-cp', b.dir, 'Main']];
  const r = spawnSync(cmd, args, { input: stdin, encoding: 'utf8', cwd: b.dir, env: env(), maxBuffer: 64 * 1024 * 1024, timeout: 60_000 });
  if (r.status !== 0) throw new Error(`${b.lang} run failed (status ${String(r.status)}):\n${r.stderr}`);
  const lines = r.stdout.split('\n').filter((l, k, all) => !(l === '' && k === all.length - 1));
  return lines.map((l) => (l.trim() === '' ? [] : l.trim().split(/\s+/).map(Number)));
}
