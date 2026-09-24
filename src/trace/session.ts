/** One trace session on a Run as a pure state machine (docs/ARCHITECTURE.md §3, §7).
 *  The session owns the ask pointer and the answers; the timeline owns `k`. Every
 *  transition returns a new Session; nothing here touches React or storage. */

import type { Step } from '@/engine/events';
import type { Run } from '@/engine/run';
import { askIndices } from '@/engine/run';
import { hashString } from '@/lib/rng';
import type { MistakeRecord, SessionRecord } from '@/lib/storage';
import { buildQuery } from '@/lib/url';
import type { Answer, Ask, Level } from './asks';
import type { GradeResult } from './grade';
import { grade } from './grade';

export interface SessionMeta {
  algorithm: string;
  variant: string;
  seed: string;
  /** Encoded input as a query string without '?' (see `encodeInput`). */
  input: string;
  startedAt: number;
}

export interface AnswerRecord {
  /** Step index of the answered ask. */
  askIndex: number;
  given: Answer;
  result: GradeResult;
  at: number;
}

export interface Session {
  readonly id: string;
  readonly meta: SessionMeta;
  readonly level: Level;
  readonly steps: readonly Step[];
  /** Step indices carrying an ask at this level, ascending. */
  readonly askIndices: readonly number[];
  /** Position in `askIndices` of the next unanswered ask. */
  readonly cursor: number;
  readonly answers: readonly AnswerRecord[];
  /** Asks revealed without grading (watch mode); not counted as asked. */
  readonly skipped: readonly number[];
  /** Step index the timeline must stop at, or null when no ask is pending. */
  readonly gate: number | null;
}

export interface RevealPlan {
  /** k of the ask just answered (the state before its step applies). */
  fromK: number;
  /** k after the answered step has applied: where the ghost and rule show. */
  revealK: number;
  /** The next gate, or the end of the run: play may run to here and must stop. */
  toK: number;
}

/** Turns a module's `encode(input)` params into the canonical stored input string ("i=1,2&x=2&v=classic"). */
export function encodeInput(params: Record<string, string>): string {
  return buildQuery(params).replace(/^\?/, '');
}

/** Deterministic session id from its identity: same algorithm, seed and start time give the same id. */
export function sessionId(meta: SessionMeta): string {
  return `s-${meta.startedAt.toString(36)}-${hashString(`${meta.algorithm}|${meta.variant}|${meta.seed}|${meta.input}`).toString(36)}`;
}

/** Starts a session on a completed run; asks are filtered by level. */
export function createSession(run: Run, level: Level, meta: SessionMeta): Session {
  const indices = askIndices(run.steps, level);
  return {
    id: sessionId(meta),
    meta,
    level,
    steps: run.steps,
    askIndices: indices,
    cursor: 0,
    answers: [],
    skipped: [],
    gate: indices[0] ?? null,
  };
}

/** The pending ask with its step index, or null when the session is finished. */
export function currentAsk(session: Session): { askIndex: number; ask: Ask } | null {
  const askIndex = session.askIndices[session.cursor];
  if (askIndex === undefined) return null;
  const ask = session.steps[askIndex]?.ask;
  if (!ask) throw new Error(`session: step ${askIndex} has no ask`);
  return { askIndex, ask };
}

/** True once every ask has been answered or skipped. */
export function isFinished(session: Session): boolean {
  return session.cursor >= session.askIndices.length;
}

function advance(session: Session, patch: Partial<Pick<Session, 'answers' | 'skipped'>>): Session {
  const cursor = session.cursor + 1;
  return { ...session, ...patch, cursor, gate: session.askIndices[cursor] ?? null };
}

/** Grades `given` against the pending ask, records it and moves the gate to the next ask. Throws when nothing is pending. */
export function submit(session: Session, given: Answer, now: number): { session: Session; result: GradeResult } {
  const cur = currentAsk(session);
  if (!cur) throw new Error('session: no pending ask to submit');
  const result = grade(cur.ask, given);
  const record: AnswerRecord = { askIndex: cur.askIndex, given, result, at: now };
  return { session: advance(session, { answers: [...session.answers, record] }), result };
}

/** Reveals the pending ask without grading (watch mode); it counts as not asked. */
export function skip(session: Session): Session {
  const cur = currentAsk(session);
  if (!cur) return session;
  return advance(session, { skipped: [...session.skipped, cur.askIndex] });
}

/** Number of graded asks so far. */
export function askedCount(session: Session): number {
  return session.answers.length;
}

/** Number of correct answers so far. */
export function correctCount(session: Session): number {
  return session.answers.filter((a) => a.result.correct).length;
}

/** correct / asked, or null when nothing has been asked. */
export function sessionScore(session: Session): number | null {
  const asked = askedCount(session);
  return asked === 0 ? null : correctCount(session) / asked;
}

/** Step indices answered wrong, ascending (timeline × marks). */
export function wrongAskIndices(session: Session): number[] {
  return session.answers.filter((a) => !a.result.correct).map((a) => a.askIndex);
}

/** The answer recorded for a step index, if any. */
export function answerAt(session: Session, askIndex: number): AnswerRecord | null {
  return session.answers.find((a) => a.askIndex === askIndex) ?? null;
}

/** After the latest answer or skip: the k range the timeline plays (from the answered step to the next gate or the end). Null before any answer. */
export function revealPlan(session: Session): RevealPlan | null {
  const prev = session.askIndices[session.cursor - 1];
  if (prev === undefined) return null;
  return { fromK: prev, revealK: prev + 1, toK: session.gate ?? session.steps.length };
}

/** The persisted summary of this session. */
export function sessionRecord(session: Session, finishedAt: number): SessionRecord {
  return {
    id: session.id,
    algorithm: session.meta.algorithm,
    variant: session.meta.variant,
    seed: session.meta.seed,
    input: session.meta.input,
    level: session.level,
    asked: askedCount(session),
    correct: correctCount(session),
    startedAt: session.meta.startedAt,
    finishedAt,
  };
}

/** One MistakeRecord per wrong answer, in answer order. */
export function mistakeRecords(session: Session): MistakeRecord[] {
  const out: MistakeRecord[] = [];
  for (const a of session.answers) {
    if (a.result.correct) continue;
    out.push({
      id: `${session.id}:${a.askIndex}`,
      algorithm: session.meta.algorithm,
      kind: a.result.kind ?? 'unclassified',
      rule: a.result.rule ?? '',
      seed: session.meta.seed,
      input: session.meta.input,
      askIndex: a.askIndex,
      at: a.at,
    });
  }
  return out;
}
