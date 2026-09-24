import { describe, expect, it } from 'vitest';
import { createRng, hashString, newSeed } from './rng';

describe('rng', () => {
  it('is deterministic for a seed and differs across seeds', () => {
    const a = createRng('k9d2');
    const b = createRng('k9d2');
    const c = createRng('k9d3');
    const sa = Array.from({ length: 20 }, () => a.int(0, 99));
    const sb = Array.from({ length: 20 }, () => b.int(0, 99));
    const sc = Array.from({ length: 20 }, () => c.int(0, 99));
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });

  it('int stays inclusive within range and covers both ends', () => {
    const r = createRng('range');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
    expect(() => r.int(5, 4)).toThrow();
  });

  it('shuffle is a permutation and does not mutate its input', () => {
    const r = createRng('s');
    const input = [1, 2, 3, 4, 5, 6];
    const out = r.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });

  it('fork gives reproducible independent streams', () => {
    const x = createRng('root').fork('inputs').int(0, 1e6);
    const y = createRng('root').fork('inputs').int(0, 1e6);
    const z = createRng('root').fork('other').int(0, 1e6);
    expect(x).toBe(y);
    expect(x).not.toBe(z);
  });

  it('hashString is stable and newSeed is url-safe', () => {
    expect(hashString('dryrun')).toBe(hashString('dryrun'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(newSeed()).toMatch(/^[a-z0-9]{6}$/);
  });
});
