/** The full trace screen layout (DESIGN §1 wireframe and §5), loaded as its
 *  own chunk by TracePlayer:
 *  - ≥ 1024 px: invariant, stage (capped to the viewport height) and
 *    narration on the left; the question panel on top of the right column,
 *    so it is above the fold however tall the drawing is, then code,
 *    variables, data-structure panels and "this run". The left column is only
 *    as wide as the stage can actually draw (its scale cap, or the height cap
 *    for tall scenes), so a small stage does not leave a hole of empty paper:
 *    the right column takes the room, and splits into two columns (question +
 *    code | state + this run) once it is wide enough. 641–1023 px: one
 *    column, question under the narration. Transport + timeline pinned at the
 *    bottom.
 *  - phones: invariant and stage stick under the top bar (while there is room
 *    left to scroll anything under them), then a Code / State
 *    switch; one bottom sheet in thumb reach holds the narration line, the
 *    timeline strip on its own full-width row (a 150 px strip was too dense
 *    for 60-step runs), the transport with a readable step counter and, when
 *    there is one, the question. */

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { AlgorithmModule } from '@/algorithms/types';
import type { Level } from '@/lib/storage';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { CodeView } from '@/render/CodeView';
import { Narration } from '@/render/Narration';
import { gridOverhang } from '@/render/SceneView';
import { AskSurface } from './AskSurface';
import { RunStats } from './RunStats';
import { ShortcutsDialog } from './ShortcutsDialog';
import { StatePanels } from './StatePanels';
import { Summary } from './Summary';
import { TraceControls } from './TraceControls';
import { useDockHeight } from './useDockHeight';
import type { TraceController } from './useTraceController';

export type Area = 'summary' | 'ask' | 'verdict' | 'start' | 'none';

/** Phone dock: TraceControls lays out one row; here the timeline wraps onto
 *  its own full-width row above the transport, and the step counter moves to
 *  the right of the transport at body size. Targets TraceControls' stable
 *  test ids so its markup stays untouched. */
const STACKED_CONTROLS =
  '[&_[data-testid=controls]]:flex-wrap [&_[data-testid=controls]]:gap-y-0.5 ' +
  '[&_[data-testid=timeline]]:order-first [&_[data-testid=timeline]]:basis-full ' +
  '[&_[data-testid=step]]:ml-auto [&_[data-testid=step]]:pr-1 [&_[data-testid=step]]:text-base [&_[data-testid=step]]:text-ink';

/** Stage scale cap on desktop (TracePlayer's `maxScale`) and the CSS height
 *  it may take (its `maxHeight`: 100dvh − 17rem). */
const STAGE_MAX_SCALE = 1.25;
const STAGE_CHROME_PX = 17 * 16;
/** The left column never gets narrower than this (narration, lens). */
const MIN_LEFT_PX = 28 * 16;

/** Width the stage will actually draw at on a wide screen: its scale cap, or
 *  less when the height cap binds (tall scenes scale down, keeping aspect). */
export function stageDrawWidth(sceneW: number, sceneH: number, viewportH: number): number {
  const byScale = sceneW * STAGE_MAX_SCALE;
  const byHeight = sceneH > 0 ? Math.max(0, viewportH - STAGE_CHROME_PX) * (sceneW / sceneH) : byScale;
  return Math.ceil(Math.min(byScale, byHeight)) + 2;
}

export interface FullLayoutProps {
  desktop: boolean;
  area: Area;
  c: TraceController;
  module: AlgorithmModule<unknown>;
  input: unknown;
  mode: 'trace' | 'watch';
  level: Level;
  maxAsks: number | undefined;
  /** Invariant lens + stage. */
  top: ReactNode;
  /** The open question, verdict or start prompt (null for none or the summary). */
  areaContent: ReactNode;
  help: boolean;
  setHelp: (open: boolean) => void;
}

export function FullLayout({ desktop, area, c, module, input, mode, level, maxAsks, top, areaContent, help, setHelp }: FullLayoutProps) {
  const [tab, setTab] = useState<'state' | 'code'>('state');
  const [measureDock, dockHeight] = useDockHeight(!desktop);
  const wide = useMediaQuery('(min-width: 1024px)');
  const [topHeight, setTopHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  useEffect(() => {
    const on = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const measureTop = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(() => setTopHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The stage sticks under the top bar only while the page still has room to
  // scroll the code and state between it and the bottom sheet.
  const sticky = viewportHeight - 56 - dockHeight - topHeight >= 96;
  // Free height for the code panel under the sticky stage: minus the top bar,
  // the State / Code switch (44 + 12 gap), the language switch when the
  // module has listings (36 + 8 gap), paddings, and the sheet.
  const hasListings = Object.keys(module.code?.[c.variant] ?? {}).length > 0;
  const codeMaxH = Math.max(96, viewportHeight - 56 - topHeight - dockHeight - 56 - (hasListings ? 44 : 0) - 16);
  const { tl, run, scene } = c;
  const shownStep = tl.k > 0 ? run.steps[tl.k - 1] : undefined;
  const state = run.states[tl.k] ?? run.states[0];
  const pseudocode = module.pseudocode[c.variant] ?? Object.values(module.pseudocode)[0] ?? [];
  const total = maxAsks !== undefined ? Math.min(maxAsks, c.session.askIndices.length) : c.session.askIndices.length;
  const onHelp = () => setHelp(true);
  const sceneW = c.layout.width + gridOverhang(c.layout);
  const leftPx = Math.max(MIN_LEFT_PX, stageDrawWidth(sceneW, scene.height, viewportHeight));

  const narration = (
    <Narration
      note={c.hiddenNote ?? (shownStep ? shownStep.note : 'Start: nothing has run yet.')}
      phase={c.hiddenNote ? undefined : shownStep?.phase}
      quiet={tl.scrubbing}
      className={desktop ? '' : 'min-h-0 text-sm'}
    />
  );
  const panel = area === 'summary' ? <Summary module={module} session={c.session} mode={mode} level={level} input={input} steps={tl.length} /> : areaContent;
  const code = <CodeView lines={pseudocode} current={shownStep ? shownStep.line : 0} module={module} variant={c.variant} />;
  const statePanels = state ? <StatePanels state={state} scene={scene} algorithm={module.meta.id} /> : null;
  const stats = mode === 'trace' ? <RunStats session={c.session} total={total} /> : null;
  const dialog = <ShortcutsDialog open={help} onClose={() => setHelp(false)} />;

  if (desktop) {
    return (
      <div data-testid="trace-player" data-variant="full" data-area={area} className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
        <div
          className="grid w-full flex-1 items-start gap-x-8 gap-y-5 px-4 pt-4 pb-6"
          style={wide ? { gridTemplateColumns: `minmax(0, ${leftPx}px) minmax(21rem, 1fr)` } : undefined}
          data-testid="trace-grid"
        >
          <section aria-label="Trace" className="flex min-w-0 flex-col gap-3">
            {top}
            {narration}
            {!wide && <AskSurface>{panel}</AskSurface>}
          </section>
          <aside aria-label="Code and state" className="@container min-w-0">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 @[44rem]:grid-cols-2! @[44rem]:gap-x-8">
              <div className="flex min-w-0 flex-col gap-5">
                {wide && <AskSurface>{panel}</AskSurface>}
                {code}
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                {statePanels}
                {stats}
              </div>
            </div>
          </aside>
        </div>
        <div className="sticky bottom-0 z-20 border-t border-rule bg-surface px-2 py-1 sm:px-4">
          <TraceControls c={c} compact={false} onHelp={onHelp} />
        </div>
        {dialog}
      </div>
    );
  }
  return (
    <div data-testid="trace-player" data-variant="full" data-area={area} className="flex flex-col">
      <div ref={measureTop} className={`${sticky ? 'sticky top-14 z-20' : ''} flex flex-col gap-2 bg-bg px-4 pt-3 pb-2`} data-sticky={sticky ? 'true' : 'false'}>
        {top}
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <Segmented
          label="Show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'state', label: 'State' },
            { value: 'code', label: 'Code' },
          ]}
        />
        {tab === 'code' ? (
          // Cap the panel to the free slot between the sticky stage and the
          // bottom sheet, so the highlighted line is never under the sheet.
          <div style={sticky ? ({ '--code-max-h': `${codeMaxH}px` } as CSSProperties) : undefined}>{code}</div>
        ) : (
          <div className="flex flex-col gap-4">
            {statePanels}
            {stats}
          </div>
        )}
      </div>
      <div aria-hidden="true" style={{ height: dockHeight }} />
      <Sheet open title="Trace controls" mode="sheet">
        <div ref={measureDock} className={`flex max-h-[62dvh] flex-col gap-2 overflow-y-auto ${STACKED_CONTROLS}`}>
          {narration}
          <TraceControls c={c} compact onHelp={onHelp} />
          {panel}
        </div>
      </Sheet>
      {dialog}
    </div>
  );
}
