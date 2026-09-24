/** Grading and mistake classification (docs/ARCHITECTURE.md §7). Pure: an ask
 *  plus the learner's answer in, a verdict with the matching distractor out. */

import type { Answer, Ask, MistakeKind } from './asks';

export interface GradeResult {
  correct: boolean;
  /** Mistake class when wrong ('unclassified' if no distractor matched); null when correct. */
  kind: MistakeKind | null;
  /** One-line rule to show when wrong; null when correct. */
  rule: string | null;
  /** The correct answer, so the UI can reveal it. */
  expected: Answer;
}

export type NormalizeResult = { ok: true; answer: Answer } | { ok: false; error: string };

/** Deep equality for answers: numbers by value, strings by value, arrays elementwise. */
export function answersEqual(a: Answer, b: Answer): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  if (typeof a === 'number' || typeof b === 'number') return typeof a === 'number' && typeof b === 'number' && a === b;
  return a === b;
}

/** Grades `given` against the ask; a wrong answer takes the first distractor it equals, else 'unclassified' with the ask's rule. */
export function grade(ask: Ask, given: Answer): GradeResult {
  if (answersEqual(ask.answer, given)) return { correct: true, kind: null, rule: null, expected: ask.answer };
  const distractors: readonly { answer: Answer; kind: MistakeKind; rule: string }[] = ask.distractors;
  const hit = distractors.find((d) => answersEqual(d.answer, given));
  if (hit) return { correct: false, kind: hit.kind, rule: hit.rule, expected: ask.answer };
  return { correct: false, kind: 'unclassified', rule: ask.rule, expected: ask.answer };
}

const NUMBER_RE = /^[-+]?\d+(\.\d+)?$/;

/** Parses a number typed by the learner; accepts the Unicode minus the UI prints. */
function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/−/g, '-');
  if (!NUMBER_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Shapes raw UI input into an Answer for the ask's kind: trims strings, parses numbers, splits order lists; rejects blanks and NaN. */
export function normalizeAnswer(ask: Ask, raw: string | string[] | number): NormalizeResult {
  switch (ask.kind) {
    case 'value': {
      if (Array.isArray(raw)) return { ok: false, error: 'Enter one number.' };
      const n = typeof raw === 'number' ? (Number.isFinite(raw) ? raw : null) : parseNumber(raw);
      if (n === null) return { ok: false, error: 'Enter a whole number, for example 3 or -1.' };
      return { ok: true, answer: n };
    }
    case 'pick':
    case 'choice': {
      if (typeof raw !== 'string') return { ok: false, error: ask.kind === 'pick' ? 'Pick one element.' : 'Pick one option.' };
      const s = raw.trim();
      if (s === '') return { ok: false, error: ask.kind === 'pick' ? 'Pick one element.' : 'Pick one option.' };
      return { ok: true, answer: s };
    }
    case 'order': {
      if (typeof raw === 'number') return { ok: false, error: 'Give the items in order.' };
      const parts = (Array.isArray(raw) ? raw : raw.split(/[,\s]+/)).map((p) => p.trim()).filter((p) => p !== '');
      if (parts.length === 0) return { ok: false, error: 'Give the items in order.' };
      return { ok: true, answer: parts };
    }
  }
}
