import { describe, expect, it } from 'vitest';
import { buildQuery, decodeIntList, encodeIntList, parseQuery, traceUrl } from './url';

describe('url', () => {
  it('round-trips a trace query and keeps lists readable', () => {
    const q = buildQuery({ i: '3,7,9', x: 42, v: 'classic', seed: 'k9d2', empty: '', skip: undefined });
    expect(q).toBe('?i=3,7,9&x=42&v=classic&seed=k9d2');
    expect(parseQuery(q)).toEqual({ i: '3,7,9', x: '42', v: 'classic', seed: 'k9d2' });
    expect(traceUrl('binary-search', { i: '1,2' })).toBe('/t/binary-search?i=1,2');
    expect(traceUrl('bfs')).toBe('/t/bfs');
  });

  it('parses odd inputs without throwing', () => {
    expect(parseQuery('')).toEqual({});
    expect(parseQuery('?')).toEqual({});
    expect(parseQuery('a&b=&=c&d=1=2')).toEqual({ a: '', b: '', d: '1=2' });
    expect(parseQuery('?g=0-1%3A4')).toEqual({ g: '0-1:4' });
  });

  it('decodes int lists with limits', () => {
    const opts = { min: 0, max: 99, maxLen: 4 };
    expect(decodeIntList('1, 2,3', opts)).toEqual([1, 2, 3]);
    expect(decodeIntList('', opts)).toEqual([]);
    expect(decodeIntList(undefined, opts)).toBeNull();
    expect(decodeIntList('1,x', opts)).toBeNull();
    expect(decodeIntList('100', opts)).toBeNull();
    expect(decodeIntList('1,2,3,4,5', opts)).toBeNull();
    expect(encodeIntList([4, 5])).toBe('4,5');
  });
});
