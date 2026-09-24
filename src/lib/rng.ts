/** Deterministic seeded RNG. Every random input in the app goes through this. */

export interface Rng {
  readonly seed: string;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  /** Returns a new shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** Independent child generator, reproducible from (seed, label). */
  fork(label: string): Rng;
}

/** cyrb53: 53-bit string hash, good enough to derive a 32-bit seed. */
export function hashString(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32 over a 32-bit state. */
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const next = mulberry32(hashString(seed) >>> 0);
  const rng: Rng = {
    seed,
    next,
    int(lo, hi) {
      if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo) {
        throw new Error(`rng.int: bad range [${lo}, ${hi}]`);
      }
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: empty list');
      const v = items[Math.floor(next() * items.length)];
      return v as (typeof items)[number];
    },
    shuffle(items) {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const a = out[i] as (typeof out)[number];
        out[i] = out[j] as (typeof out)[number];
        out[j] = a;
      }
      return out;
    },
    fork(label) {
      return createRng(`${seed}/${label}`);
    },
  };
  return rng;
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Short, URL-safe seed for new sessions. Uses Math.random on purpose: this is the
 *  only place randomness is not seeded, and the result becomes the seed. */
export function newSeed(length = 6): string {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}
