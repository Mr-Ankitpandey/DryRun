/** The full trace screen layout (DESIGN §1 wireframe and §5), loaded as its
 *  own chunk by TracePlayer:
 *  - ≥ 1024 px: invariant, stage (capped to the viewport height) and
 *    narration on the left; the question panel on top of the right column,
 *    so it is above the fold however tall the drawing is, then code,
 *    variables, data-structure panels and "this run". 641–1023 px: one
 *    column, question under the narration. Transport + timeline pinned at the
 *    bottom.
 *  - phones: invariant and stage stick under the top bar (while there is room
 *    left to scroll anything under them), then a Code / State
 *    switch; one bottom sheet in thumb reach holds the narration line, the
 *    timeline strip and, when there is one, the question. */

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AlgorithmModule } from '@/algorithms/types';
import type { Level } from '@/trace/asks';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { CodeView } from '@/render/CodeView';
import { Narration } from '@/render/Narration';
import { AskSurface } from './AskSurface';
import { RunStats } from './RunStats';
import { ShortcutsDialog } from './ShortcutsDialog';
import { StatePanels } from './StatePanels';
import { Summary } from './Summary';
import { TraceControls } from './TraceControls';
import { useDockHeight } from './useDockHeight';
import type { TraceController } from './useTraceController';

export type Area = 'summary' | 'ask' | 'verdict' | 'start' | 'none';

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
  const { tl, run, scene } = c;
  const shownStep = tl.k > 0 ? run.steps[tl.k - 1] : undefined;
  const state = run.states[tl.k] ?? run.states[0];
  const pseudocode = module.pseudocode[c.variant] ?? Object.values(module.pseudocode)[0] ?? [];
  const total = maxAsks !== undefined ? Math.min(maxAsks, c.session.askIndices.length) : c.session.askIndices.length;
  const onHelp = () => setHelp(true);

  const narration = <Narration note={shownStep ? shownStep.note : 'Start: nothing has run yet.'} phase={shownStep?.phase} className={desktop ? '' : 'min-h-0 text-sm'} />;
  const panel = area === 'summary' ? <Summary module={module} session={c.session} mode={mode} level={level} input={input} steps={tl.length} /> : areaContent;
  const code = <CodeView lines={pseudocode} current={shownStep ? shownStep.line : 0} />;
  const statePanels = state ? <StatePanels state={state} scene={scene} /> : null;
  const stats = mode === 'trace' ? <RunStats session={c.session} total={total} /> : null;
  const dialog = <ShortcutsDialog open={help} onClose={() => setHelp(false)} />;

  if (desktop) {
    return (
      <div data-testid="trace-player" data-variant="full" data-area={area} className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
        <div className="grid w-full flex-1 items-start gap-x-8 gap-y-5 px-4 pt-4 pb-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <section aria-label="Trace" className="flex min-w-0 flex-col gap-3">
            {top}
            {narration}
            {!wide && <AskSurface>{panel}</AskSurface>}
          </section>
          <aside aria-label="Code and state" className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-1">
            {wide && <AskSurface>{panel}</AskSurface>}
            {code}
            <div className="flex min-w-0 flex-col gap-4">
              {statePanels}
              {stats}
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
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'state', label: 'State' },
            { value: 'code', label: 'Code' },
          ]}
        />
        {tab === 'code' ? (
          code
        ) : (
          <div className="flex flex-col gap-4">
            {statePanels}
            {stats}
          </div>
        )}
      </div>
      <div aria-hidden="true" style={{ height: dockHeight }} />
      <Sheet open title="Trace controls" mode="sheet">
        <div ref={measureDock} className="flex max-h-[62dvh] flex-col gap-2 overflow-y-auto">
          {narration}
          <TraceControls c={c} compact onHelp={onHelp} />
          {panel}
        </div>
      </Sheet>
      {dialog}
    </div>
  );
}
