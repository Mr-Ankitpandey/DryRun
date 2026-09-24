import { describe, expect, it } from 'vitest';
import { binarySearch } from '@/algorithms/binary-search';
import { askIndices, run } from '@/engine/run';
import type { Ask, ChoiceAsk, OrderAsk, PickAsk, ValueAsk } from './asks';
import { answersEqual, grade, normalizeAnswer } from './grade';

const basic = { a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 42, variant: 'classic' as const };
const absent = { a: [3, 7, 9, 12, 15, 21, 30, 42, 51], x: 20, variant: 'classic' as const };

function asksOf(input: typeof basic, level: 'guided' | 'full'): Ask[] {
  const r = run(binarySearch.initialState(input), binarySearch.generate(input));
  return askIndices(r.steps, level).map((i) => r.steps[i]?.ask as Ask);
}

function firstOfKind<K extends Ask['kind']>(asks: Ask[], kind: K): Extract<Ask, { kind: K }> {
  const a = asks.find((x) => x.kind === kind);
  if (!a) throw new Error(`no ${kind} ask`);
  return a as Extract<Ask, { kind: K }>;
}

describe('grade with real binary-search asks', () => {
  const guided = asksOf(basic, 'guided');
  const full = asksOf(basic, 'full');

  it('pick: correct answer', () => {
    const ask = firstOfKind(guided, 'pick');
    expect(ask.answer).toBe('e:4');
    expect(grade(ask, 'e:4')).toEqual({ correct: true, kind: null, rule: null, expected: 'e:4' });
  });

  it('pick: distractor gives its kind and rule', () => {
    const ask = firstOfKind(guided, 'pick');
    const d = ask.distractors.find((x) => x.answer === 'e:0');
    expect(d?.kind).toBe('boundary');
    const g = grade(ask, 'e:0');
    expect(g.correct).toBe(false);
    expect(g.kind).toBe('boundary');
    expect(g.rule).toBe(d?.rule);
    expect(g.expected).toBe('e:4');
  });

  it('pick: a wrong candidate that matches no distractor is unclassified with the ask rule', () => {
    const ask = firstOfKind(guided, 'pick');
    expect(ask.distractors.some((d) => d.answer === 'e:7')).toBe(false);
    expect(grade(ask, 'e:7')).toEqual({ correct: false, kind: 'unclassified', rule: ask.rule, expected: 'e:4' });
  });

  it('pick: a number given for an id ask is simply wrong', () => {
    const ask = firstOfKind(guided, 'pick');
    expect(grade(ask, 4).correct).toBe(false);
    expect(grade(ask, 4).kind).toBe('unclassified');
  });

  it('choice: correct, comparison distractor', () => {
    const ask = firstOfKind(full, 'choice');
    expect(grade(ask, ask.answer).correct).toBe(true);
    const wrong = ask.options.find((o) => o !== ask.answer) as string;
    const g = grade(ask, wrong);
    expect(g.correct).toBe(false);
    expect(g.kind).toBe('base-case');
  });

  it('value: -1 on the absent preset, index vs value distractor on the found preset', () => {
    const last = asksOf(absent, 'guided').at(-1) as ValueAsk;
    expect(last.kind).toBe('value');
    expect(last.answer).toBe(-1);
    expect(grade(last, -1).correct).toBe(true);
    expect(grade(last, 0).correct).toBe(false);
    const found = guided.at(-1) as ValueAsk;
    expect(found.answer).toBe(7);
    const g = grade(found, 42);
    expect(g.correct).toBe(false);
    expect(g.kind).toBe('unclassified');
    expect(g.rule).toBe('Return the index, not the value.');
    expect(grade(found, 6).kind).toBe('unclassified');
    expect(grade(found, 6).rule).toBe(found.rule);
  });

  it('every real ask grades its own answer as correct and no distractor as correct', () => {
    for (const p of binarySearch.presets) {
      const r = run(binarySearch.initialState(p.input), binarySearch.generate(p.input));
      for (const i of askIndices(r.steps, 'full')) {
        const ask = r.steps[i]?.ask as Ask;
        expect(grade(ask, ask.answer).correct).toBe(true);
        for (const d of ask.distractors) {
          const g = grade(ask, d.answer);
          expect(g.correct).toBe(false);
          expect(g.kind).toBe(d.kind);
        }
      }
    }
  });
});

describe('grade order asks (hand-built)', () => {
  const ask: OrderAsk = {
    kind: 'order',
    level: 'full',
    prompt: 'Pop order?',
    answer: ['n:1', 'n:2', 'n:3'],
    pool: ['n:1', 'n:2', 'n:3'],
    rule: 'Smaller distance first; ties by node id.',
    distractors: [{ answer: ['n:3', 'n:2', 'n:1'], kind: 'order', rule: 'A queue pops front first.' }],
  };

  it('exact sequence equality', () => {
    expect(grade(ask, ['n:1', 'n:2', 'n:3']).correct).toBe(true);
    expect(grade(ask, ['n:1', 'n:2']).correct).toBe(false);
    expect(grade(ask, ['n:2', 'n:1', 'n:3']).kind).toBe('unclassified');
  });

  it('matches array distractors deeply', () => {
    const g = grade(ask, ['n:3', 'n:2', 'n:1']);
    expect(g.kind).toBe('order');
    expect(g.rule).toBe('A queue pops front first.');
  });

  it('answersEqual never confuses kinds', () => {
    expect(answersEqual(['a'], 'a')).toBe(false);
    expect(answersEqual('1', 1)).toBe(false);
    expect(answersEqual(1, 1)).toBe(true);
    expect(answersEqual(Number.NaN, Number.NaN)).toBe(false);
  });
});

describe('normalizeAnswer', () => {
  const value: ValueAsk = { kind: 'value', level: 'guided', prompt: '', answer: -1, rule: 'r', distractors: [] };
  const pick: PickAsk = { kind: 'pick', level: 'guided', prompt: '', answer: 'e:1', candidates: ['e:0', 'e:1'], rule: 'r', distractors: [] };
  const choice: ChoiceAsk = { kind: 'choice', level: 'full', prompt: '', answer: 'Yes', options: ['Yes', 'No'], rule: 'r', distractors: [] };
  const order: OrderAsk = { kind: 'order', level: 'full', prompt: '', answer: ['a', 'b'], pool: ['a', 'b'], rule: 'r', distractors: [] };

  it('value parses "-1", " -1 ", unicode minus and numbers; rejects blanks and NaN', () => {
    expect(normalizeAnswer(value, '-1')).toEqual({ ok: true, answer: -1 });
    expect(normalizeAnswer(value, ' -1 ')).toEqual({ ok: true, answer: -1 });
    expect(normalizeAnswer(value, '−1')).toEqual({ ok: true, answer: -1 });
    expect(normalizeAnswer(value, 7)).toEqual({ ok: true, answer: 7 });
    expect(normalizeAnswer(value, '').ok).toBe(false);
    expect(normalizeAnswer(value, 'abc').ok).toBe(false);
    expect(normalizeAnswer(value, Number.NaN).ok).toBe(false);
    expect(normalizeAnswer(value, ['1']).ok).toBe(false);
  });

  it('pick and choice trim strings and reject other shapes', () => {
    expect(normalizeAnswer(pick, ' e:1 ')).toEqual({ ok: true, answer: 'e:1' });
    expect(normalizeAnswer(pick, 1).ok).toBe(false);
    expect(normalizeAnswer(choice, 'Yes')).toEqual({ ok: true, answer: 'Yes' });
    expect(normalizeAnswer(choice, '  ').ok).toBe(false);
  });

  it('order accepts arrays or comma/space separated text', () => {
    expect(normalizeAnswer(order, ['a', ' b '])).toEqual({ ok: true, answer: ['a', 'b'] });
    expect(normalizeAnswer(order, 'a, b')).toEqual({ ok: true, answer: ['a', 'b'] });
    expect(normalizeAnswer(order, '').ok).toBe(false);
    expect(normalizeAnswer(order, 3).ok).toBe(false);
  });
});
