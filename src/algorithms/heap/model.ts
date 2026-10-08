/** Plain binary min-heap operations with the module's exact tie rules (the
 *  reference for tests, input validation and random-input targets):
 *  - sift-up stops when the parent is ≤ the value (an equal parent stays);
 *  - sift-down compares with the smaller child, the LEFT one when the two are
 *    equal (`a[r] < a[l]` is strict), and stops when the value is ≤ that child.
 *  Each operation also reports what happened, so targets can ask for inputs
 *  with a tie or a long sift. */

export type HeapOp = 'insert' | 'extract' | 'build';

export interface HeapInput {
  a: number[];
  op: HeapOp;
  /** The value to insert; carried (and ignored) by the other operations. */
  x: number;
}

export interface HeapStats {
  /** Swaps made by the operation. */
  swaps: number;
  /** Most levels one sift travelled. */
  longest: number;
  /** A sift-down met two equal children, or a sift met an equal parent/child. */
  tie: boolean;
  /** Some sift ran out of room: a value rose to the root or sank to a leaf. */
  end: boolean;
}

export interface HeapResult {
  heap: number[];
  /** extract: the value taken (null on an empty heap); other ops: null. */
  extracted: number | null;
}

export const parentOf = (i: number): number => Math.floor((i - 1) / 2);

export function isMinHeap(a: readonly number[]): boolean {
  return firstViolation(a) === null;
}

/** First child slot whose value is smaller than its parent's, or null. */
export function firstViolation(a: readonly number[]): number | null {
  for (let c = 1; c < a.length; c++) if ((a[c] as number) < (a[parentOf(c)] as number)) return c;
  return null;
}

function siftUp(a: number[], i: number, st: HeapStats): void {
  let levels = 0;
  while (i > 0) {
    const p = parentOf(i);
    if ((a[p] as number) === (a[i] as number)) st.tie = true;
    if ((a[p] as number) <= (a[i] as number)) break;
    [a[i], a[p]] = [a[p] as number, a[i] as number];
    st.swaps++;
    levels++;
    i = p;
  }
  if (i === 0) st.end = true;
  st.longest = Math.max(st.longest, levels);
}

function siftDown(a: number[], i: number, st: HeapStats): void {
  let levels = 0;
  for (;;) {
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l >= a.length) {
      st.end = true;
      break;
    }
    let c = l;
    if (r < a.length) {
      if ((a[r] as number) === (a[l] as number)) st.tie = true;
      if ((a[r] as number) < (a[l] as number)) c = r;
    }
    if ((a[i] as number) === (a[c] as number)) st.tie = true;
    if ((a[i] as number) <= (a[c] as number)) break;
    [a[i], a[c]] = [a[c] as number, a[i] as number];
    st.swaps++;
    levels++;
    i = c;
  }
  st.longest = Math.max(st.longest, levels);
}

export function runOp(input: HeapInput): { result: HeapResult; stats: HeapStats } {
  const a = [...input.a];
  const st: HeapStats = { swaps: 0, longest: 0, tie: false, end: false };
  let extracted: number | null = null;
  if (input.op === 'insert') {
    a.push(input.x);
    siftUp(a, a.length - 1, st);
  } else if (input.op === 'extract') {
    if (a.length > 0) {
      extracted = a[0] as number;
      const last = a.pop() as number;
      if (a.length > 0) {
        a[0] = last;
        siftDown(a, 0, st);
      }
    }
  } else {
    for (let k = Math.floor(a.length / 2) - 1; k >= 0; k--) siftDown(a, k, st);
  }
  return { result: { heap: a, extracted }, stats: st };
}

/** Bottom-up build with the module's tie rules (used to make valid heaps). */
export function heapify(values: readonly number[]): number[] {
  return runOp({ a: [...values], op: 'build', x: 0 }).result.heap;
}
