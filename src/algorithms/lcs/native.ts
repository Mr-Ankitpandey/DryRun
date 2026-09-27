/** Test-only helper (same as dfs/native.ts; each module folder stays self-contained): finds python3 / a C++ compiler / javac + java with `which`
 *  and runs a program with every write kept inside ./.scratch/wp-m/<dir>
 *  (sources, binaries, class files, compiler temp files, JVM temp dir).
 *  On macOS the /usr/bin tools are xcrun shims that may write a cache outside
 *  the project; when the Command Line Tools binary exists it is used directly. */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CLT = '/Library/Developer/CommandLineTools';

export interface Native {
  python: string | null;
  cxx: { bin: string; args: string[] } | null;
  java: { javac: string; java: string } | null;
}

function which(name: string): string | null {
  try {
    const out = execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out === '' ? null : out;
  } catch {
    return null;
  }
}

/** /usr/bin shim → the Command Line Tools binary when present. */
function unshim(path: string, name: string): string {
  const direct = `${CLT}/usr/bin/${name}`;
  return path.startsWith('/usr/bin/') && existsSync(direct) ? direct : path;
}

export function detect(): Native {
  const py = which('python3');
  let cxx: Native['cxx'] = null;
  for (const name of ['c++', 'clang++', 'g++']) {
    const p = which(name);
    if (!p) continue;
    const bin = unshim(p, name);
    const sdk = `${CLT}/SDKs/MacOSX.sdk`;
    cxx = { bin, args: bin.startsWith(CLT) && existsSync(sdk) ? ['-isysroot', sdk] : [] };
    break;
  }
  const javac = which('javac');
  const java = which('java');
  return {
    python: py ? unshim(py, 'python3') : null,
    cxx,
    java: javac && java ? { javac, java } : null,
  };
}

export function scratch(dir: string): { root: string; tmp: string; env: NodeJS.ProcessEnv } {
  const root = resolve(process.cwd(), '.scratch', 'wp-m', dir);
  const tmp = join(root, 'tmp');
  mkdirSync(tmp, { recursive: true });
  return { root, tmp, env: { ...process.env, TMPDIR: tmp, PYTHONDONTWRITEBYTECODE: '1' } };
}

const run = (bin: string, args: string[], env: NodeJS.ProcessEnv, cwd: string, input?: string): string =>
  execFileSync(bin, args, { cwd, env, input: input ?? '', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });

export function runPython(n: Native, dir: string, source: string, input: string): string {
  if (!n.python) throw new Error('python3 not found');
  const s = scratch(dir);
  const file = join(s.root, 'prog.py');
  writeFileSync(file, source);
  return run(n.python, ['-I', '-B', file], s.env, s.root, input);
}

export function runCpp(n: Native, dir: string, source: string, input: string): string {
  if (!n.cxx) throw new Error('no C++ compiler found');
  const s = scratch(dir);
  const file = join(s.root, 'prog.cpp');
  const exe = join(s.root, 'prog');
  writeFileSync(file, source);
  run(n.cxx.bin, [...n.cxx.args, '-std=c++17', '-O1', '-Wall', '-o', exe, file], s.env, s.root);
  return run(exe, [], s.env, s.root, input);
}

export function runJava(n: Native, dir: string, source: string, input: string): string {
  if (!n.java) throw new Error('javac/java not found');
  const s = scratch(dir);
  const file = join(s.root, 'Main.java');
  const classes = join(s.root, 'classes');
  writeFileSync(file, source);
  const jvm = ['-XX:-UsePerfData', `-Djava.io.tmpdir=${s.tmp}`];
  run(n.java.javac, [...jvm.map((a) => `-J${a}`), '-d', classes, file], s.env, s.root);
  return run(n.java.java, [...jvm, '-cp', classes, 'Main'], s.env, s.root, input);
}
