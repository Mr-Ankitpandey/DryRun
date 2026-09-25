/** TracePlayer: the one component that runs a trace (ask → commit → reveal →
 *  ghost/rule → next ask) for any algorithm module. Used by the trace screen
 *  and review sessions (variant 'full') and the landing hero (variant 'compact').
 *
 *  CONTRACT (lead-owned, frozen for wave 2): the props below. WP-E owns the
 *  implementation and may add files under src/app/trace/**, but must not change
 *  or remove these props. Callers (WP-F landing, WP-H review) build against them.
 *
 *  Layout: 'compact' is invariant + stage + question panel, drawn here;
 *  'full' is FullLayout.tsx (its own chunk). */

import { Suspense, lazy, useMemo, useState } from 'react';
import type { AlgorithmModule } from '@/algorithms/types';
import type { Level } from '@/trace/asks';
import type { GradeResult } from '@/trace/grade';
import type { Session } from '@/trace/session';
import { encodeInput } from '@/trace/session';
import { DESKTOP_QUERY, useMediaQuery } from '@/ui/useMediaQuery';
import { HoverProvider } from '@/render/HoverProvider';
import { MotionModeProvider } from '@/render/MotionMode';
import { SceneView, gridOverhang } from '@/render/SceneView';
import { AskPanel } from './AskPanel';
import { AskSurface } from './AskSurface';
import { InvariantLens } from './InvariantLens';
import { labelFor } from './logic';
import { StageOverlay } from './StageOverlay';
import { StartPanel } from './StartPanel';
import { useTraceController } from './useTraceController';
import { useTraceKeys } from './useTraceKeys';
import type { Area } from './FullLayout';
import { VerdictPanel } from './VerdictPanel';

/** Everything only the trace screen needs (code, panels, timeline, summary,
 *  shortcuts, the phone sheet) is its own chunk, so the landing hero's compact
 *  player stays small. */
const FullLayout = lazy(() => import('./FullLayout').then((mod) => ({ default: mod.FullLayout })));

export interface TracePlayerProps {
  /** An already-loaded module (callers resolve it via the registry or a static import). */
  module: AlgorithmModule<unknown>;
  /** A decoded, validated input for that module. */
  input: unknown;
  /** Seed recorded with the session (URL seed or review seed). */
  seed: string;
  /** 'trace' gates play at asks; 'watch' plays through with no asks. */
  mode: 'trace' | 'watch';
  level: Level;
  /** 'full': stage, code, panels, timeline, transport. 'compact': stage + ask only. */
  variant: 'full' | 'compact';
  /** Stop after this many graded answers (landing hero uses 2). */
  maxAsks?: number;
  /** Open with the timeline already at the first ask instead of step 0. */
  startAtFirstAsk?: boolean;
  /** Commit the finished session to the store (history, mistakes, review queue). */
  persist?: boolean;
  /** After every graded answer. */
  onAnswer?: (result: GradeResult, session: Session) => void;
  /** Once, when the session ends: all asks answered, maxAsks reached, or watch end. */
  onFinish?: (session: Session) => void;
}

/** A new trace identity (input, seed, mode, level) is a new session: remount. */
export function TracePlayer(props: TracePlayerProps) {
  const identity = `${props.module.meta.id}|${encodeInput(props.module.encode(props.input))}|${props.seed}|${props.mode}|${props.level}|${props.variant}`;
  return <Player key={identity} {...props} />;
}

function Player({ module, input, seed, mode, level, variant, maxAsks, startAtFirstAsk, persist, onAnswer, onFinish }: TracePlayerProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const compact = variant === 'compact';
  const c = useTraceController({ module, input, seed, mode, level, form: desktop ? 'desktop' : 'mobile', maxAsks, startAtFirstAsk, persist, onAnswer, onFinish });
  const { tl, run, scene, layout, verdict, open, pending } = c;
  const [help, setHelp] = useState(false);
  const debug = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1', []);

  const invariant = module.invariant[c.variant] ?? Object.values(module.invariant)[0] ?? { name: 'Invariant', sentence: '' };
  const state = run.states[tl.k] ?? run.states[0];

  // ---- what the question area shows
  const area: Area =
    !compact && c.finished && tl.k >= tl.length && (!verdict || verdict.ack)
      ? 'summary'
      : open
        ? 'ask'
        : verdict && mode === 'trace'
          ? 'verdict'
          : mode === 'trace' && pending && !c.ended
            ? 'start'
            : 'none';
  const showVerdict = verdict !== null && open === null && area === 'verdict';
  const nextHere = pending !== null && pending.askIndex === tl.k && !c.ended;
  const action = !verdict ? null : verdict.last ? (compact ? null : 'See summary') : nextHere ? 'Next question' : 'Continue';
  const onContinue = () => {
    if (verdict?.last) c.nav({ type: 'seek', k: tl.length });
    else c.proceed();
  };
  const canContinue = (area === 'verdict' && action !== null && !tl.playing) || (area === 'start' && !tl.playing);

  useTraceKeys({ ask: open ? open.ask.kind : null, canContinue, modal: help }, (cmd) => {
    switch (cmd.type) {
      case 'toggle':
        return c.nav({ type: 'toggle' });
      case 'continue':
        return area === 'start' ? c.nav({ type: 'play' }) : onContinue();
      case 'prev':
        return c.nav({ type: 'prev' });
      case 'next':
        return c.nav({ type: 'next' });
      case 'answer':
        return c.answerNth(cmd.n);
      case 'submit':
        return c.orderSubmit();
      case 'undo':
        return c.orderUndo();
      case 'help':
        return setHelp(!compact);
      case 'close':
        return setHelp(false);
    }
  });

  const firstCandidate = open?.ask.kind === 'pick' ? scene.prims.get(open.ask.candidates[0] ?? '') : undefined;
  const pickNoun = firstCandidate?.kind === 'bar' ? 'element' : firstCandidate?.kind === 'cell' ? 'cell' : 'node';
  const label = (id: string) => labelFor(scene, id);

  const areaContent =
    area === 'ask' && open ? (
      <AskPanel
        ask={open.ask}
        askIndex={open.askIndex}
        order={open.order}
        hintCount={open.hints.size}
        onAnswer={c.answer}
        seq={c.orderSeq}
        label={label}
        onOrderAdd={c.orderAdd}
        onOrderUndo={c.orderUndo}
        onOrderClear={c.orderClear}
        onOrderSubmit={c.orderSubmit}
        debug={debug}
        desktop={desktop}
        pickNoun={pickNoun}
      />
    ) : area === 'verdict' && verdict ? (
      <VerdictPanel verdict={verdict} note={compact ? (run.steps[verdict.plan.fromK]?.note ?? null) : null} action={action} busy={tl.playing} onContinue={onContinue} />
    ) : area === 'start' && pending ? (
      <StartPanel k={tl.k} gate={pending.askIndex} playing={tl.playing} onPlay={() => c.nav({ type: 'play' })} />
    ) : null;

  const stage = (
    <div className="overflow-x-auto overflow-y-hidden rounded-sm border border-rule bg-bg" style={{ maxWidth: Math.ceil((layout.width + gridOverhang(layout)) * (compact || !desktop ? 1 : 1.25)) + 2 }} data-testid="stage-wrap">
      <SceneView
        scene={scene}
        layout={layout}
        label={`${module.meta.title}, step ${tl.k} of ${tl.length}`}
        interactive={open?.ask.kind === 'pick'}
        minWidth={desktop ? 0 : Math.round((layout.width + gridOverhang(layout)) * 0.72)}
        maxScale={compact || !desktop ? 1 : 1.25}
        maxHeight={!compact && desktop ? 'calc(100dvh - 17rem)' : undefined}
        overlay={<StageOverlay scene={scene} open={open} verdict={verdict} showVerdict={showVerdict} onPick={c.answer} />}
      />
    </div>
  );
  const lens = <InvariantLens name={invariant.name} sentence={invariant.sentence} vars={state?.vars ?? {}} />;

  const body = compact ? (
    <div data-testid="trace-player" data-variant="compact" data-area={area} className="flex flex-col gap-3">
      {lens}
      {stage}
      <AskSurface>{areaContent}</AskSurface>
    </div>
  ) : (
    <Suspense fallback={<div data-testid="trace-player" data-variant="full" className="min-h-[60dvh]" aria-busy="true" />}>
      <FullLayout
        desktop={desktop}
        area={area}
        c={c}
        module={module}
        input={input}
        mode={mode}
        level={level}
        maxAsks={maxAsks}
        top={
          <>
            {lens}
            {stage}
          </>
        }
        areaContent={areaContent}
        help={help}
        setHelp={setHelp}
      />
    </Suspense>
  );

  return (
    <MotionModeProvider scrubbing={tl.scrubbing} speed={tl.speed} hints={c.hints}>
      <HoverProvider>
        {body}
      </HoverProvider>
    </MotionModeProvider>
  );
}
