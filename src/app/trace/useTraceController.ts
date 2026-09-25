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
 *  at the gate (timeline reducer). Watch mode skips every ask up front. */

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
import type { Answer, Ask, Level } from '@/trace/asks';
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

  const [startedAt] = useState(() => Date.now());
  const [session, setSession] = useState<Session>(() => {
    let s = createSession(run, level, { algorithm: module.meta.id, variant, seed, input: encodeInput(module.encode(input)), startedAt });
    if (mode === 'watch') while (currentAsk(s)) s = skip(s);
    return s;
  });

  const [tl, dispatch] = useReducer(timelineReducer, null, (): Timeline => {
    const gate = mode === 'trace' ? session.gate : null;
    const t = createTimeline(run.steps.length, gate);
    return startAtFirstAsk && gate !== null ? { ...t, k: gate } : t;
  });

  const [verdict, setVerdict] = useState<Verdict | null>(null);
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

  // ---- the open ask
  const pending = currentAsk(session);
  const waiting = verdict !== null && !verdict.ack;
  const ended = finished || (maxAsks !== undefined && session.answers.length >= maxAsks);
  const open: OpenAsk | null = useMemo(() => {
    if (mode !== 'trace' || ended || !pending || tl.k !== pending.askIndex || waiting) return null;
    const { ask, askIndex } = pending;
    if (ask.kind === 'pick') {
      const order = hintOrder(ask.candidates, (id) => {
        const o = outlineOf(scene, id, 0);
        return o ? { x: o.cx, y: o.cy } : null;
      });
      return { ask, askIndex, order, hints: keyHints(order) };
    }
    if (ask.kind === 'order') {
      const order = poolOrder(ask.pool, (id) => labelFor(scene, id));
      return { ask, askIndex, order, hints: keyHints(order) };
    }
    return { ask, askIndex, order: [], hints: new Map() };
  }, [mode, ended, pending, tl.k, waiting, scene]);

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
      if (a.type === 'play' || a.type === 'toggle') playStart.current = true;
      if (a.type !== 'speed' && a.type !== 'scrubEnd' && a.type !== 'pause') acknowledge();
      dispatch(a);
    },
    [acknowledge],
  );

  const answer = useCallback(
    (given: Answer) => {
      const cur = currentAsk(session);
      if (!cur || !open || cur.askIndex !== tl.k) return;
      const { session: next, result } = submit(session, given, Date.now());
      const plan = revealPlan(next);
      if (!plan) return;
      const last = isFinished(next) || (maxAsks !== undefined && next.answers.length >= maxAsks);
      const ask = cur.ask;
      const truthId = ask.kind === 'pick' ? ask.answer : null;
      const truth = truthId ? markFor(scene, truthId) : null;
      const ghost = ask.kind === 'pick' && !result.correct && typeof given === 'string' ? markFor(scene, given) : null;
      setSession(next);
      setVerdict({ ask, askIndex: cur.askIndex, given, result, plan, askedScene: scene, ghost, truth, last, ack: false });
      dispatch({ type: 'gate', gate: last ? null : next.gate });
      dispatch({ type: 'next' });
      onAnswer?.(result, next);
      if (last) finish(next);
    },
    [session, open, tl.k, maxAsks, scene, onAnswer, finish],
  );

  /** Continue after a verdict (or start): play on to the next gate. */
  const proceed = useCallback(() => {
    if (verdict && !verdict.ack && pending && tl.k === pending.askIndex && !ended) {
      acknowledge(); // the next question is right here
      return;
    }
    if (tl.k >= tl.length) {
      acknowledge();
      return;
    }
    nav({ type: 'play' });
  }, [verdict, pending, tl.k, tl.length, ended, acknowledge, nav]);

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

  return {
    run,
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
