import { describe, expect, it } from 'vitest';
import { binarySearch } from '@/algorithms/binary-search';
import { registry } from '@/algorithms/registry';
import type { ReviewItem } from '@/lib/storage';
import { parseQuery } from '@/lib/url';
import { DAY_MS } from '@/learn/scheduler';
import { finishLine, heroInput, keepTracingHref, welcomeFor } from './hero';
import { landingStills } from './stills';

const NOW = Date.UTC(2026, 8, 25, 12);
const item = (algorithm: string, due: number): ReviewItem => ({ algorithm, box: 1, due, reviews: 1, lastScore: 1 });

describe('hero', () => {
  it('traces the basic preset: 9 sorted values, target 42', () => {
    expect(heroInput()).toEqual({ a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 42, variant: 'classic' });
  });

  it('"Keep tracing" deep-links to the same input and seed, and the link decodes back', () => {
    const href = keepTracingHref();
    expect(href).toBe('/t/binary-search?i=3,7,9,12,15,21,30,42,51&x=42&v=classic&seed=hero');
    const q = parseQuery(href.slice(href.indexOf('?')));
    expect(binarySearch.decode(q)).toEqual(heroInput());
    expect(q.seed).toBe('hero');
  });

  it('finish line states the score and what is left, singular and plural', () => {
    expect(finishLine({ asked: 2, correct: 2, remaining: 3 })).toBe('Both right. The full trace has 3 more questions before the search ends.');
    expect(finishLine({ asked: 2, correct: 1, remaining: 1 })).toBe('1 of 2 right. The full trace has 1 more question before the search ends.');
    expect(finishLine({ asked: 2, correct: 0, remaining: 0 })).toBe('0 of 2 right. That was the whole search.');
    expect(finishLine({ asked: 1, correct: 1, remaining: 2 })).toBe('1 of 1 right. The full trace has 2 more questions before the search ends.');
  });
});

describe('welcomeFor', () => {
  it('is null when nothing is due (the hero stays)', () => {
    expect(welcomeFor({}, NOW, registry)).toBeNull();
    expect(welcomeFor({ bst: item('bst', NOW + DAY_MS) }, NOW, registry)).toBeNull();
  });

  it('builds the welcome line from due items with registry minutes, earliest first', () => {
    const w = welcomeFor({ bst: item('bst', NOW - 1), dijkstra: item('dijkstra', NOW - DAY_MS), 'quick-sort': item('quick-sort', NOW + 1) }, NOW, registry);
    expect(w).toEqual({ line: 'Welcome back — 2 re-traces due, ~9 minutes.', titles: ['Dijkstra (lazy deletion)', 'BST insert, search, delete'] });
  });

  it('keeps unknown ids visible rather than dropping them', () => {
    const w = welcomeFor({ 'no-such-algorithm': item('no-such-algorithm', NOW) }, NOW, registry);
    expect(w?.titles).toEqual(['no-such-algorithm']);
    expect(w?.line).toBe('Welcome back — 1 re-trace due, ~3 minutes.');
  });
});

describe('landingStills', () => {
  const s = landingStills();

  it('predict is the first hero ask, before mid is placed', () => {
    expect(s.predict.caption).toBe('lo = 0, hi = 8. Where does mid land?');
    const mid = s.predict.scene.prims.get('p:mid');
    expect(mid === undefined || (mid.kind === 'caret' && !mid.visible)).toBe(true);
  });

  it('reveal shows the second hero ask answered: lo moved to 5, ghost on the real boundary distractor (mid)', () => {
    expect(s.reveal.ghost).toBe('e:4');
    expect(s.reveal.kind).toBe('Boundary / off-by-one');
    expect(s.reveal.caption).toBe('lo moves past mid: a[mid] is already known not to be x.');
    const lo = s.reveal.scene.prims.get('p:lo');
    const bar5 = s.reveal.scene.prims.get('e:5');
    expect(lo?.kind).toBe('caret');
    expect(bar5?.kind).toBe('bar');
    if (lo?.kind === 'caret' && bar5?.kind === 'bar') expect(lo.x).toBeCloseTo(bar5.x + bar5.w / 2, 5);
    expect(s.reveal.scene.prims.has(s.reveal.ghost ?? '')).toBe(true);
  });

  it('re-trace is a different, valid input from a fixed seed, at its first ask', () => {
    expect(s.retrace.input).not.toEqual(heroInput());
    expect(binarySearch.validate(binarySearch.encode(s.retrace.input)).ok).toBe(true);
    expect(s.retrace.input.a).toContain(s.retrace.input.x);
    expect(s.retrace.caption).toMatch(/^lo = 0, hi = \d+\. Where does mid land\?$/);
    expect(landingStills().retrace.input).toEqual(s.retrace.input);
  });
});
