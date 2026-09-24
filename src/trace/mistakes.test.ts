import { describe, expect, it } from 'vitest';
import type { MistakeRecord } from '@/lib/storage';
import { parseQuery } from '@/lib/url';
import { mistakeBank, retraceUrl } from './mistakes';

const rec = (over: Partial<MistakeRecord>): MistakeRecord => ({
  id: 'm',
  algorithm: 'binary-search',
  kind: 'boundary',
  rule: 'mid rounds down.',
  seed: 'k9d2',
  input: 'i=3,7,9&x=42&v=classic',
  askIndex: 2,
  at: 100,
  ...over,
});

describe('mistakeBank', () => {
  it('is empty for no records', () => {
    expect(mistakeBank([])).toEqual({ total: 0, byKind: [], byAlgorithm: [] });
  });

  it('groups by kind with count, last seen, newest rule and occurrences newest first', () => {
    const bank = mistakeBank([
      rec({ id: 'a', at: 100, rule: 'old rule' }),
      rec({ id: 'b', at: 300, rule: 'new rule', seed: 'zz', askIndex: 6 }),
      rec({ id: 'c', at: 200, kind: 'comparison', rule: 'cmp', algorithm: 'dijkstra' }),
      rec({ id: 'd', at: 50, kind: 'stale', rule: 'stale', algorithm: 'dijkstra' }),
      rec({ id: 'e', at: 60, kind: 'stale', rule: 'stale2', algorithm: 'dijkstra' }),
    ]);
    expect(bank.total).toBe(5);
    expect(bank.byKind.map((g) => [g.kind, g.count])).toEqual([
      ['boundary', 2],
      ['stale', 2],
      ['comparison', 1],
    ]);
    const boundary = bank.byKind[0];
    expect(boundary?.label).toBe('Boundary / off-by-one');
    expect(boundary?.lastSeen).toBe(300);
    expect(boundary?.rule).toBe('new rule');
    expect(boundary?.occurrences.map((o) => o.id)).toEqual(['b', 'a']);
    expect(boundary?.occurrences[0]).toEqual({ id: 'b', algorithm: 'binary-search', seed: 'zz', input: 'i=3,7,9&x=42&v=classic', askIndex: 6, at: 300, rule: 'new rule' });
    expect(bank.byKind[1]?.rule).toBe('stale2');
  });

  it('groups per algorithm with kind breakdown', () => {
    const bank = mistakeBank([
      rec({ id: 'a' }),
      rec({ id: 'c', at: 200, kind: 'comparison', algorithm: 'dijkstra' }),
      rec({ id: 'd', at: 50, kind: 'stale', algorithm: 'dijkstra' }),
      rec({ id: 'e', at: 60, kind: 'stale', algorithm: 'dijkstra' }),
    ]);
    expect(bank.byAlgorithm).toEqual([
      {
        algorithm: 'dijkstra',
        count: 3,
        lastSeen: 200,
        kinds: [
          { kind: 'stale', label: 'Stale entry', count: 2 },
          { kind: 'comparison', label: 'Comparison direction', count: 1 },
        ],
      },
      { algorithm: 'binary-search', count: 1, lastSeen: 100, kinds: [{ kind: 'boundary', label: 'Boundary / off-by-one', count: 1 }] },
    ]);
  });

  it('does not mutate its input', () => {
    const input = [rec({ id: 'a', at: 1 }), rec({ id: 'b', at: 2 })];
    const copy = structuredClone(input);
    mistakeBank(input);
    expect(input).toEqual(copy);
  });
});

describe('retraceUrl', () => {
  it('rebuilds the trace link from the stored input params, seed and mode', () => {
    const url = retraceUrl(rec({}));
    expect(url.startsWith('/t/binary-search?')).toBe(true);
    expect(parseQuery(url.slice(url.indexOf('?')))).toEqual({ i: '3,7,9', x: '42', v: 'classic', seed: 'k9d2', mode: 'trace' });
    expect(url).toBe('/t/binary-search?i=3,7,9&x=42&v=classic&seed=k9d2&mode=trace');
  });

  it('adds the level when given and tolerates a leading question mark', () => {
    const url = retraceUrl(rec({ input: '?g=0-1:4,0-2:1&s=0', algorithm: 'dijkstra' }), 'full');
    expect(parseQuery(url.slice(url.indexOf('?')))).toEqual({ g: '0-1:4,0-2:1', s: '0', seed: 'k9d2', mode: 'trace', level: 'full' });
  });
});
