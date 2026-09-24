import { describe, expect, it } from 'vitest';
import type { MistakeRecord, SessionRecord, Store } from '@/lib/storage';
import { appendMistakes, appendSession, defaultStore, touch, upsertReview } from '@/lib/storage';
import { sessionSummaryText } from './summary';

const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);
const DAY = 24 * 3600 * 1000;

const session = (over: Partial<SessionRecord>): SessionRecord => ({
  id: 'x',
  algorithm: 'binary-search',
  variant: 'classic',
  seed: 'secret-seed',
  input: 'i=3,7,9&x=42&v=classic',
  level: 'guided',
  asked: 4,
  correct: 3,
  startedAt: NOW - 1000,
  finishedAt: NOW - 500,
  ...over,
});
const mistake = (over: Partial<MistakeRecord>): MistakeRecord => ({
  id: 'm',
  algorithm: 'binary-search',
  kind: 'boundary',
  rule: 'mid rounds down.',
  seed: 'secret-seed',
  input: 'i=3,7,9&x=42&v=classic',
  askIndex: 1,
  at: NOW - 500,
  ...over,
});

function sampleStore(): Store {
  let s = touch(defaultStore(), Date.UTC(2026, 8, 1));
  s = appendSession(s, session({ id: 'a' }));
  s = appendSession(s, session({ id: 'b', asked: 6, correct: 6, finishedAt: NOW - 45 * DAY }));
  s = appendSession(s, session({ id: 'c', algorithm: 'dijkstra', asked: 8, correct: 5 }));
  s = appendSession(s, session({ id: 'w', asked: 0, correct: 0 }));
  s = appendMistakes(s, [mistake({ id: '1' }), mistake({ id: '2', kind: 'stale', algorithm: 'dijkstra' }), mistake({ id: '3' })]);
  s = upsertReview(s, { algorithm: 'binary-search', box: 2, due: NOW + DAY, reviews: 3, lastScore: 0.75 });
  s = upsertReview(s, { algorithm: 'dijkstra', box: 0, due: NOW + DAY, reviews: 1, lastScore: 0.625 });
  return s;
}

describe('sessionSummaryText', () => {
  it('renders the exact digest', () => {
    const text = sessionSummaryText(sampleStore(), NOW, { appVersion: '0.0.1' });
    expect(text).toBe(
      [
        'DryRun session summary',
        'App version: 0.0.1',
        'Generated: 2026-09-25',
        'Using since: 2026-09-01',
        'Sessions: 4 total, 3 graded, 2 in the last 30 days',
        'Answers: 14/18 correct (78%)',
        'Mistakes recorded: 3',
        '',
        'Per algorithm:',
        '- binary-search: 2 sessions, 9/10 correct (90%), review box 2 after 3 reviews',
        '- dijkstra: 1 session, 5/8 correct (63%), review box 0 after 1 review',
        '',
        'Top mistakes:',
        '- Boundary / off-by-one: 2',
        '- Stale entry: 1',
        '',
        'Settings: level guided, theme system, motion system',
      ].join('\n'),
    );
  });

  it('is deterministic and never includes seeds or inputs', () => {
    const a = sessionSummaryText(sampleStore(), NOW, { appVersion: '0.0.1' });
    const b = sessionSummaryText(sampleStore(), NOW, { appVersion: '0.0.1' });
    expect(a).toBe(b);
    expect(a).not.toContain('secret-seed');
    expect(a).not.toContain('i=3,7,9');
    expect(a).not.toContain('42');
  });

  it('handles a fresh store', () => {
    const text = sessionSummaryText(defaultStore(), NOW, { appVersion: '0.0.1' });
    expect(text).toContain('Using since: n/a');
    expect(text).toContain('Sessions: 0 total, 0 graded, 0 in the last 30 days');
    expect(text).toContain('Answers: 0/0 correct (n/a)');
    expect(text).toContain('Per algorithm:\n- none yet');
    expect(text).toContain('Top mistakes:\n- none yet');
  });

  it('limits the mistake list to topMistakes', () => {
    const text = sessionSummaryText(sampleStore(), NOW, { appVersion: '0.0.1', topMistakes: 1 });
    expect(text).toContain('- Boundary / off-by-one: 2');
    expect(text).not.toContain('Stale entry');
  });
});
