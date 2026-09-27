/** The trace loop as one hook: run → layout → session → timeline, and the
 *  actions the UI calls. Every rule lives in pure code (engine timeline
 *  reducer, trace session, logic.ts); this hook only sequences them:
 *
 *    at a gate        k === session.gate and no verdict is waiting → the ask is open
 *    submit(answer)   grade → move the gate to the next ask → play the answered
 *                     step (fromK → revealK) → show the verdict (ghost or ring)
 *    continue         acknowledge the verdict and play to the next gate
 *
 *  Play is a timer sized by the step on screen (logic.playDelayMs) and stops
 *  at the gate (timeline reducer). Watch mode skips every ask up front.
 *
 *  Blind (blind.ts): the gate is the frozen point F, so the stage, lens, code
 *  and timeline stop there and the ask opens at k === F with the steps up to
 *  it hidden. An answer starts the reveal: F → G + 1 at REVEAL_SPEED (instant
 *  with reduced motion), then the verdict, then F moves to G + 1. */

import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AlgorithmModule } from '@/algorithms/types';
import type { Id } from '@/engine/events';
import type { Run } from '@/engine/run';
import { run as runSteps } from '@/engine/run';
import type { Scene } from '@/engine/scene';
import { buildScene } from '@/engine/scene';
import type { Speed, Timeline, TimelineAction } from '@/engine/timeline';
import { createTimeline, timelineReducer } from '@/engine/timeline';
import { commitSession, startAlgorithm } from '@/learn/commit';
import { useMotionPref } from '@/ui/motion';
import type { Answer, Ask } from '@/trace/asks';
import type { Level } from '@/lib/storage';
import type { GradeResult } from '@/trace/grade';
import type { RevealPlan, Session } from '@/trace/session';
import { createSession, currentAsk, encodeInput, isFinished, revealPlan, skip, submit, wrongAskIndices } from '@/trace/session';
import { StoreContext } from '@/ui/store';
import type { MoveHints } from '@/render/motion-hints';
import { NO_HINTS, moveHints } from '@/render/motion-hints';
import type { Outline } from '@/render/outline';
import { outlineOf } from '@/render/outline';
import type { FormFactor } from './logic';
import { hintOrder, keyHints, labelFor, layoutFor, playDelayMs, poolOrder, resolveTransient } from './logic';
import type { BlindView } from './blind';
import { REVEAL_SPEED, askIdOf, blindView, frozenAsk, hiddenSentence, revealDelayMs, timelineGate, withNote } from './blind';

export interface ControllerInput {
  module: AlgorithmModule<unknown>;
  input: unknown;
  seed: string;
  mode: 'trace' | 'watch';
  level: Level;
  form: FormFactor;
  maxAsks?: number | undefined;
  startAtFirstAsk?: boolean | undefined;
  persist?: boolean | undefined;
  onAnswer?: ((result: GradeResult, session: Session) => void) | undefined;
  onFinish?: ((session: Session) => void) | undefined;
}

/** Where to draw the ghost / ring: a fixed outline (an array slot, as it was
 *  when asked) or a node to follow as it moves. */
export type Mark = { fixed: Outline } | { follow: Id };

export interface Verdict {
  ask: Ask;
  askIndex: number;
  given: Answer;
  result: GradeResult;
  plan: RevealPlan;
  /** The scene the question was asked on (labels for the answers). */
  askedScene: Scene;
  /** The learner's pick, when wrong. */
  ghost: Mark | null;
  /** The right answer's element: green when correct, pen when wrong. */
  truth: Mark | null;
  /** The session ended with this answer. */
  last: boolean;
  /** The learner has moved on (Continue, play, step, scrub). */
  ack: boolean;
}

export interface OpenAsk {
  ask: Ask;
  askIndex: number;
  /** pick: candidates in key order; order: pool as offered; else []. */
  order: Id[];
  hints: Map<Id, number>;
}

function markFor(scene: Scene, id: Id): Mark | null {
  const p = scene.prims.get(id);
  if (!p) return null;
  if (p.kind === 'bar' || p.kind === 'cell') {
    const o = outlineOf(scene, id, 5);
    return o ? { fixed: o } : null;
  }
  return { follow: id };
}

export function useTraceController(opts: ControllerInput) {
  const { module, input, seed, mode, level, form, maxAsks, startAtFirstAsk, persist, onAnswer, onFinish } = opts;
  const storeCtx = useContext(StoreContext);

  const run: Run = useMemo(() => runSteps(module.initialState(input), module.generate(input), { maxSteps: module.meta.caps.maxSteps }), [module, input]);
  const layout = useMemo(() => layoutFor(run, form), [run, form]);
  const variant = module.variantOf(input);
  /** Blind applies to traces only; watch mode plays everything. */
  const blind = level === 'blind' && mode === 'trace';
  const reduced = useMotionPref().reduced;

  const [startedAt] = useState(() => Date.now());
  const [session, setSession] = useState<Session>(() => {
    let s = createSession(run, level, { algorithm: module.meta.id, variant, seed, input: encodeInput(module.encode(input)), startedAt });
    if (mode === 'watch') while (currentAsk(s)) s = skip(s);
    return s;
  });

  const [tl, dispatch] = useReducer(timelineReducer, null, (): Timeline => {
    const gate = mode === 'trace' ? timelineGate(level, run, session) : null;
    const t = createTimeline(run.steps.length, gate);
    return startAtFirstAsk && gate !== null ? { ...t, k: gate } : t;
  });

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  /** Blind: the reveal after an answer plays k up to `to`, then the verdict shows. */
  const [reveal, setReveal] = useState<{ from: number; to: number } | null>(null);
  const revealing = reveal !== null && tl.k < reveal.to;
  const [jumped, setJumped] = useState(0);
  const [orderSeq, setOrderSeq] = useState<Id[]>([]);
  const [finished, setFinished] = useState(false);
  const finishedRef = useRef(false);
  const playStart = useRef(false);

  // ---- persistence and finish (exactly once)
  useEffect(() => {
    if (persist && storeCtx) storeCtx.update((s) => startAlgorithm(s, module.meta.id, Date.now()));
    // Only on mount of this trace identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(
    (s: Session) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setFinished(true);
      if (persist && storeCtx) storeCtx.update((store) => commitSession(store, s, Date.now()).store);
      onFinish?.(s);
    },
    [persist, storeCtx, onFinish],
  );

  // Watch mode ends when the run has been played to the end.
  useEffect(() => {
    if (mode === 'watch' && tl.k >= tl.length && !finishedRef.current) finish(session);
  }, [mode, tl.k, tl.length, finish, session]);

  // ---- scene at k, and how elements travel into it
  const raw = run.states[tl.k] ?? run.states[0];
  if (!raw) throw new Error('trace: run has no states');
  const state = useMemo(() => resolveTransient(run.states[tl.k - 1], run.steps[tl.k - 1], raw), [run, tl.k, raw]);
  const scene = useMemo(() => buildScene(state, layout, { width: layout.width }), [state, layout]);
  const sceneAt = useCallback(
    (k: number): Scene => {
      const s = run.states[k];
      if (!s) throw new Error(`trace: no state ${k}`);
      return buildScene(resolveTransient(run.states[k - 1], run.steps[k - 1], s), layout, { width: layout.width });
    },
    [run, layout],
  );
  const [shown, setShown] = useState<{ k: number; hints: MoveHints }>({ k: tl.k, hints: NO_HINTS });
  if (shown.k !== tl.k) {
    const fwd = tl.k === shown.k + 1;
    const back = tl.k === shown.k - 1;
    setShown({ k: tl.k, hints: fwd ? moveHints(run.states[shown.k], run.steps[shown.k]) : back ? moveHints(run.states[tl.k], run.steps[tl.k]) : NO_HINTS });
  }
  const hints = shown.k === tl.k ? shown.hints : NO_HINTS;

  // ---- play timer
  useEffect(() => {
    if (!tl.playing) return;
    const first = playStart.current;
    playStart.current = false;
    const id = window.setTimeout(() => dispatch({ type: 'next' }), playDelayMs(run.steps[tl.k - 1], tl.speed, first));
    return () => window.clearTimeout(id);
  }, [tl.playing, tl.k, tl.speed, run]);

  // ---- blind reveal: F → G + 1, one step at a time, faster than play
  useEffect(() => {
    if (!reveal || tl.k >= reveal.to) return;
    const id = window.setTimeout(() => dispatch({ type: 'next' }), revealDelayMs(run.steps[tl.k - 1]));
    return () => window.clearTimeout(id);
  }, [reveal, tl.k, run]);

  // A skipped reveal lands with zero-duration transitions (a scrub), then
  // leaves scrubbing on the next frame so later steps animate again.
  useEffect(() => {
    if (jumped === 0) return;
    const id = window.requestAnimationFrame(() => dispatch({ type: 'scrubEnd' }));
    return () => window.cancelAnimationFrame(id);
  }, [jumped]);

  // ---- the open ask
  const pending = useMemo(() => currentAsk(session), [session]);
  const view: BlindView | null = useMemo(() => (blind ? blindView(run, session.askIndices, session.cursor) : null), [blind, run, session]);
  /** k at which the pending ask opens: the ask's step, or the frozen point in Blind. */
  const askAt = pending ? (view ? view.frozenK : pending.askIndex) : null;
  const waiting = verdict !== null && !verdict.ack;
  const ended = finished || (maxAsks !== undefined && session.answers.length >= maxAsks);
  /** Blind: the scene the pending ask is really asked on (never drawn; labels and grading only). */
  const askScene = useMemo(() => (view && pending && view.askK !== tl.k ? sceneAt(view.askK) : scene), [view, pending, tl.k, sceneAt, scene]);
  const label = useCallback((id: Id) => (scene.prims.has(id) ? labelFor(scene, id) : labelFor(askScene, id)), [scene, askScene]);
  const open: OpenAsk | null = useMemo(() => {
    if (mode !== 'trace' || ended || !pending || tl.k !== askAt || waiting) return null;
    const { askIndex } = pending;
    const frozen = run.states[tl.k];
    const atAsk = run.states[askIndex];
    const ask = view && frozen && atAsk ? frozenAsk(pending.ask, frozen, atAsk) : pending.ask;
    if (ask.kind === 'pick') {
      const order = hintOrder(ask.candidates, (id) => {
        const o = outlineOf(scene, id, 0);
        return o ? { x: o.cx, y: o.cy } : null;
      });
      return { ask, askIndex, order, hints: keyHints(order) };
    }
    if (ask.kind === 'order') {
      const order = poolOrder(ask.pool, label);
      return { ask, askIndex, order, hints: keyHints(order) };
    }
    return { ask, askIndex, order: [], hints: new Map() };
  }, [mode, ended, pending, tl.k, askAt, waiting, scene, run, view, label]);

  // A new ask starts with an empty order.
  const openKey = open ? open.askIndex : -1;
  const [orderFor, setOrderFor] = useState(openKey);
  if (orderFor !== openKey) {
    setOrderFor(openKey);
    setOrderSeq([]);
  }

  // ---- actions
  const acknowledge = useCallback(() => setVerdict((v) => (v && !v.ack ? { ...v, ack: true } : v)), []);

  const nav = useCallback(
    (a: TimelineAction) => {
      // The reveal is not scrubbable while it runs; it can only be skipped.
      if (revealing && a.type !== 'speed') return;
      if (reveal) setReveal(null);
      if (a.type === 'play' || a.type === 'toggle') playStart.current = true;
      if (a.type !== 'speed' && a.type !== 'scrubEnd' && a.type !== 'pause') acknowledge();
      dispatch(a);
    },
    [acknowledge, revealing, reveal],
  );

  /** Blind: jump to the end of the reveal (Skip, Enter or Space). */
  const skipReveal = useCallback(() => {
    if (!reveal || tl.k >= reveal.to) return;
    dispatch({ type: 'scrub', k: reveal.to });
    setJumped((n) => n + 1);
  }, [reveal, tl.k]);

  const answer = useCallback(
    (given: Answer) => {
      const cur = currentAsk(session);
      if (!cur || !open || askAt !== tl.k) return;
      const ask = cur.ask;
      // Blind: a pick on the frozen stage names an element at the ask.
      const frozen = run.states[tl.k];
      const atAsk = run.states[cur.askIndex];
      const graded = view && ask.kind === 'pick' && typeof given === 'string' && frozen && atAsk ? askIdOf(ask, given, frozen, atAsk) : given;
      const { session: next, result } = submit(session, graded, Date.now());
      const plan = revealPlan(next);
      if (!plan) return;
      const last = isFinished(next) || (maxAsks !== undefined && next.answers.length >= maxAsks);
      const truthId = ask.kind === 'pick' ? ask.answer : null;
      const truth = truthId ? markFor(askScene, truthId) : null;
      const ghost = ask.kind === 'pick' && !result.correct && typeof graded === 'string' ? markFor(askScene, graded) : null;
      setSession(next);
      setVerdict({ ask, askIndex: cur.askIndex, given: graded, result, plan, askedScene: askScene, ghost, truth, last, ack: false });
      dispatch({ type: 'gate', gate: last ? null : timelineGate(level, run, next) });
      if (view && view.hidden > 0) {
        // The hidden steps and the answered one play through, then the verdict.
        if (reduced) dispatch({ type: 'seek', k: view.revealTo });
        else setReveal({ from: tl.k, to: view.revealTo });
      } else dispatch({ type: 'next' });
      onAnswer?.(result, next);
      if (last) finish(next);
    },
    [session, open, askAt, tl.k, run, view, maxAsks, askScene, level, reduced, onAnswer, finish],
  );

  /** Continue after a verdict (or start): play on to the next gate. */
  const proceed = useCallback(() => {
    if (revealing) {
      skipReveal();
      return;
    }
    if (verdict && !verdict.ack && pending && tl.k === askAt && !ended) {
      acknowledge(); // the next question is right here
      return;
    }
    if (tl.k >= tl.length) {
      acknowledge();
      return;
    }
    nav({ type: 'play' });
  }, [revealing, skipReveal, verdict, pending, tl.k, askAt, tl.length, ended, acknowledge, nav]);

  const answerNth = useCallback(
    (n: number) => {
      if (!open) return;
      if (open.ask.kind === 'pick') {
        const id = open.order[n - 1];
        if (id && open.hints.get(id) === n) answer(id);
      } else if (open.ask.kind === 'choice') {
        const o = open.ask.options[n - 1];
        if (o !== undefined) answer(o);
      } else if (open.ask.kind === 'order') {
        const id = open.order[n - 1];
        if (id && !orderSeq.includes(id)) setOrderSeq((s) => [...s, id]);
      }
    },
    [open, orderSeq, answer],
  );

  const orderAdd = useCallback((id: Id) => setOrderSeq((s) => (s.includes(id) ? s : [...s, id])), []);
  const orderUndo = useCallback(() => setOrderSeq((s) => s.slice(0, -1)), []);
  const orderClear = useCallback(() => setOrderSeq([]), []);
  const orderSubmit = useCallback(() => {
    if (open?.ask.kind === 'order' && orderSeq.length === open.ask.pool.length) answer(orderSeq);
  }, [open, orderSeq, answer]);

  const setSpeed = useCallback((s: Speed) => dispatch({ type: 'speed', speed: s }), []);

  const wrong = useMemo(() => wrongAskIndices(session), [session]);
  const right = useMemo(() => session.answers.filter((a) => a.result.correct).map((a) => a.askIndex), [session]);
  const phases = useMemo(() => run.steps.map((s) => s.phase), [run]);

  // Blind: while the ask is open the narration says how many steps ran
  // hidden instead of the frozen step's note (views read notes from `viewRun`).
  const hiddenNote = view && open && view.hidden > 0 ? hiddenSentence(view.hidden) : null;
  const viewRun = useMemo(() => (hiddenNote ? withNote(run, tl.k, hiddenNote) : run), [hiddenNote, run, tl.k]);
  /** Playback speed of transitions: the reveal runs at REVEAL_SPEED. */
  const motionSpeed = revealing ? Math.max(REVEAL_SPEED, tl.speed) : tl.speed;

  return {
    run,
    viewRun,
    hiddenNote,
    blind: view,
    revealing,
    reveal,
    askAt,
    label,
    motionSpeed,
    skipReveal,
    layout,
    scene,
    hints,
    tl,
    session,
    verdict,
    open,
    pending,
    ended,
    finished,
    orderSeq,
    wrong,
    right,
    phases,
    variant,
    nav,
    answer,
    answerNth,
    proceed,
    orderAdd,
    orderUndo,
    orderClear,
    orderSubmit,
    setSpeed,
  };
}

export type TraceController = ReturnType<typeof useTraceController>;
