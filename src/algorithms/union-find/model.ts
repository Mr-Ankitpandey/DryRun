/** Plain union-find with union by rank (ties: the smaller id becomes the
 *  parent) and two-pass path compression: the reference for tests, input
 *  targets and the invariant. */

export type UfOp = { t: 'u'; a: number; b: number } | { t: 'f'; x: number };

export interface UfInput {
  n: number;
  ops: UfOp[];
}

export interface UfResult {
  parent: number[];
  /** Rank of every root; null for nodes that are not roots. */
  rank: (number | null)[];
  /** The root each standalone find returned, in order. */
  finds: number[];
}

export interface UfStats {
  /** Pointers changed by path compression. */
  compressions: number;
  /** Unions whose two elements were already in one set. */
  sameSet: number;
  /** Unions of two roots with equal rank. */
  ties: number;
}

export class Dsu {
  parent: number[];
  rank: number[];
  stats: UfStats = { compressions: 0, sameSet: 0, ties: 0 };

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = Array.from({ length: n }, () => 0);
  }

  /** The path from x to its root, x first, root last. */
  path(x: number): number[] {
    const out = [x];
    while (this.parent[out[out.length - 1] as number] !== out[out.length - 1]) out.push(this.parent[out[out.length - 1] as number] as number);
    return out;
  }

  find(x: number): number {
    let r = x;
    while (this.parent[r] !== r) r = this.parent[r] as number;
    while (this.parent[x] !== r) {
      const next = this.parent[x] as number;
      this.parent[x] = r;
      this.stats.compressions++;
      x = next;
    }
    return r;
  }

  /** The two roots in (parent, child) order, or null when already joined. */
  union(a: number, b: number): { ra: number; rb: number } | null {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) {
      this.stats.sameSet++;
      return null;
    }
    if ((this.rank[ra] as number) < (this.rank[rb] as number)) [ra, rb] = [rb, ra];
    else if (this.rank[ra] === this.rank[rb] && rb < ra) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    if (this.rank[ra] === this.rank[rb]) {
      this.stats.ties++;
      this.rank[ra] = (this.rank[ra] as number) + 1;
    }
    return { ra, rb };
  }

  roots(): number[] {
    return this.parent.map((p, i) => (p === i ? i : -1)).filter((i) => i !== -1);
  }
}

export function runOps(input: UfInput): { result: UfResult; stats: UfStats; dsu: Dsu } {
  const d = new Dsu(input.n);
  const finds: number[] = [];
  for (const op of input.ops) {
    if (op.t === 'u') d.union(op.a, op.b);
    else finds.push(d.find(op.x));
  }
  const rank = d.rank.map((r, i) => (d.parent[i] === i ? r : null));
  return { result: { parent: [...d.parent], rank, finds }, stats: d.stats, dsu: d };
}

/** The sets after the first k operations, as a canonical string. */
export function partitionAfter(input: UfInput, k: number): string {
  const d = new Dsu(input.n);
  for (const op of input.ops.slice(0, k)) {
    if (op.t === 'u') d.union(op.a, op.b);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < input.n; i++) {
    const r = d.find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  }
  return [...groups.values()]
    .map((g) => g.join(','))
    .sort()
    .join(' | ');
}
