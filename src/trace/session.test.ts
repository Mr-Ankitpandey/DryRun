import { describe, expect, it } from 'vitest';
import { binarySearch } from '@/algorithms/binary-search';
import { run } from '@/engine/run';
import { createTimeline, timelineReducer } from '@/engine/timeline';
import type { SessionMeta } from './session';
import {
  answerAt,
  createSession,
  currentAsk,
  encodeInput,
  isFinished,
  mistakeRecords,
  revealPlan,
  sessionId,
  sessionRecord,
  sessionScore,
  skip,
  submit,
  wrongAskIndices,
} from './session';

const basic = { a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 42, variant: 'classic' as const };
const meta: SessionMeta = { algorithm: 'binary-search', variant: 'classic', seed: 'k9d2', input: encodeInput(binarySearch.encode(basic)), startedAt: 1_000 };
const basicRun = run(binarySearch.initialState(basic), binarySearch.generate(basic));

describe('session on the basic binary-search preset', () => {
  it('encodeInput produces a query string without the question mark', () => {
    expect(meta.input).toBe('i=3,7,9,12,15,21,30,42,51&x=42&v=classic');
  });

  it('starts at the first guided ask with a gate', () => {
    const s = createSession(basicRun, 'guided', meta);
    expect(s.askIndices).toEqual([2, 4, 6, 8, 10, 12]);
    expect(s.gate).toBe(2);
    expect(s.cursor).toBe(0);
    expect(currentAsk(s)?.ask.kind).toBe('pick');
    expect(sessionScore(s)).toBeNull();
    expect(revealPlan(s)).toBeNull();
    expect(isFinished(s)).toBe(false);
  });

  it('full level includes the choice asks', () => {
    const s = createSession(basicRun, 'full', meta);
    expect(s.askIndices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(s.gate).toBe(1);
  });

  it('submit grades, records, advances the gate and never mutates the input', () => {
    const s0 = createSession(basicRun, 'guided', meta);
    const { session: s1, result } = submit(s0, 'e:4', 2_000);
    expect(result.correct).toBe(true);
    expect(s0.cursor).toBe(0);
    expect(s0.answers).toHaveLength(0);
    expect(s1.cursor).toBe(1);
    expect(s1.gate).toBe(4);
    expect(s1.answers).toEqual([{ askIndex: 2, given: 'e:4', result, at: 2_000 }]);
    expect(answerAt(s1, 2)?.given).toBe('e:4');
    expect(answerAt(s1, 4)).toBeNull();
    expect(revealPlan(s1)).toEqual({ fromK: 2, revealK: 3, toK: 4 });
  });

  it('wrong answers are classified and become mistake records with the seed and input', () => {
    const s0 = createSession(basicRun, 'guided', meta);
    const a = submit(s0, 'e:0', 10); // boundary distractor
    const b = submit(a.session, 'e:5', 20); // correct
    const c = submit(b.session, 'e:1', 30); // unclassified
    expect(a.result.kind).toBe('boundary');
    expect(c.result.kind).toBe('unclassified');
    expect(wrongAskIndices(c.session)).toEqual([2, 6]);
    expect(sessionScore(c.session)).toBeCloseTo(1 / 3);
    const ms = mistakeRecords(c.session);
    expect(ms).toHaveLength(2);
    expect(ms[0]).toEqual({
      id: `${s0.id}:2`,
      algorithm: 'binary-search',
      kind: 'boundary',
      rule: a.result.rule,
      seed: 'k9d2',
      input: meta.input,
      askIndex: 2,
      at: 10,
    });
    expect(ms[1]?.kind).toBe('unclassified');
    expect(ms[1]?.rule).toBe(currentAsk(b.session)?.ask.rule);
  });

  it('runs to completion; the last reveal plays to the end of the run', () => {
    let s = createSession(basicRun, 'guided', meta);
    const answers = ['e:4', 'e:5', 'e:6', 'e:7', 'e:7', 7] as const;
    for (const given of answers) s = submit(s, given, 5).session;
    expect(isFinished(s)).toBe(true);
    expect(s.gate).toBeNull();
    expect(currentAsk(s)).toBeNull();
    expect(sessionScore(s)).toBe(1);
    expect(revealPlan(s)).toEqual({ fromK: 12, revealK: 13, toK: basicRun.steps.length });
    expect(() => submit(s, 'e:0', 6)).toThrow(/no pending ask/);
    const rec = sessionRecord(s, 9_000);
    expect(rec).toEqual({
      id: s.id,
      algorithm: 'binary-search',
      variant: 'classic',
      seed: 'k9d2',
      input: meta.input,
      level: 'guided',
      asked: 6,
      correct: 6,
      startedAt: 1_000,
      finishedAt: 9_000,
    });
    expect(mistakeRecords(s)).toEqual([]);
  });

  it('skip reveals without grading and does not count as asked', () => {
    const s0 = createSession(basicRun, 'guided', meta);
    const s1 = skip(s0);
    expect(s1.skipped).toEqual([2]);
    expect(s1.answers).toHaveLength(0);
    expect(s1.gate).toBe(4);
    expect(sessionScore(s1)).toBeNull();
    expect(revealPlan(s1)).toEqual({ fromK: 2, revealK: 3, toK: 4 });
    let s = s1;
    for (let i = 0; i < 10; i++) s = skip(s);
    expect(isFinished(s)).toBe(true);
    expect(skip(s)).toBe(s);
    expect(sessionRecord(s, 1).asked).toBe(0);
  });

  it('the gate drives the frozen timeline: play stops at the ask and resumes after grading', () => {
    const s0 = createSession(basicRun, 'guided', meta);
    let t = createTimeline(basicRun.steps.length, s0.gate);
    t = timelineReducer(t, { type: 'play' });
    for (let i = 0; i < 20; i++) t = timelineReducer(t, { type: 'next' });
    expect(t.k).toBe(2);
    expect(t.playing).toBe(false);
    const { session: s1 } = submit(s0, 'e:4', 0);
    t = timelineReducer(t, { type: 'gate', gate: s1.gate });
    const plan = revealPlan(s1);
    expect(plan?.fromK).toBe(t.k);
    for (let i = 0; i < 20; i++) t = timelineReducer(t, { type: 'next' });
    expect(t.k).toBe(plan?.toK);
  });

  it('session ids are deterministic and distinct per seed and start', () => {
    expect(sessionId(meta)).toBe(sessionId({ ...meta }));
    expect(sessionId(meta)).not.toBe(sessionId({ ...meta, seed: 'zzzz' }));
    expect(sessionId(meta)).not.toBe(sessionId({ ...meta, startedAt: 1_001 }));
    expect(createSession(basicRun, 'guided', meta).id).toBe(sessionId(meta));
  });

  it('a run with no asks at this level is finished immediately', () => {
    const empty = { a: [], x: 5, variant: 'classic' as const };
    const r = run(binarySearch.initialState(empty), binarySearch.generate(empty));
    const s = createSession(r, 'guided', meta);
    // The empty preset only has the final value ask, which is guided.
    expect(s.askIndices.length).toBeGreaterThanOrEqual(1);
    const none = createSession({ ...r, steps: r.steps.map((st) => ({ line: st.line, events: st.events, note: st.note })) }, 'full', meta);
    expect(none.askIndices).toEqual([]);
    expect(none.gate).toBeNull();
    expect(isFinished(none)).toBe(true);
  });
});
