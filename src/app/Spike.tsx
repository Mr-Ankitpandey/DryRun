/** Engine spike page (owned by WP-A). Runs a module preset or a synthetic
 *  fixture through `run()`, computes the layout once, builds the scene for the
 *  current step and renders it with the bare SVG views and panels. Routes:
 *  /spike (binary search) and /spike/:id (tree | graph | grid | recursion). */

import { useMemo, useReducer, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useParams } from 'wouter';
import { binarySearch } from '@/algorithms/binary-search';
import type { Preset } from '@/algorithms/types';
import { computeLayout } from '@/engine/layout';
import { run } from '@/engine/run';
import type { Run } from '@/engine/run';
import { buildScene } from '@/engine/scene';
import { createTimeline, timelineReducer } from '@/engine/timeline';
import { fixtureIds, fixtures } from '@/render/fixtures';
import { CallStackPanel } from '@/render/CallStackPanel';
import { CodeView } from '@/render/CodeView';
import { DistTable } from '@/render/DistTable';
import { HoverProvider } from '@/render/HoverProvider';
import { MotionModeProvider } from '@/render/MotionMode';
import { Narration } from '@/render/Narration';
import { PQPanel } from '@/render/PQPanel';
import { QueuePanel } from '@/render/QueuePanel';
import { SceneView } from '@/render/SceneView';
import { StackPanel } from '@/render/StackPanel';
import { VarsPanel } from '@/render/VarsPanel';

const VIEW = { width: 900 };
const BS = 'binary-search';

interface Loaded {
  id: string;
  title: string;
  pseudocode: string[];
  run: Run;
}

function load(id: string): Loaded {
  const fixture = fixtures[id];
  if (fixture) return { id, title: fixture.title, pseudocode: fixture.pseudocode, run: run(fixture.initial, fixture.steps) };
  const preset = binarySearch.presets[0] as Preset<(typeof binarySearch.presets)[number]['input']>;
  const lines = binarySearch.pseudocode[binarySearch.variantOf(preset.input)] ?? [];
  return {
    id: BS,
    title: `${binarySearch.meta.title}: ${preset.title}`,
    pseudocode: lines,
    run: run(binarySearch.initialState(preset.input), binarySearch.generate(preset.input), { maxSteps: binarySearch.meta.caps.maxSteps }),
  };
}

export default function Spike() {
  const params = useParams<{ id?: string }>();
  const id = params.id && fixtures[params.id] ? params.id : BS;
  return <SpikeTrace key={id} id={id} />;
}

function SpikeTrace({ id }: { id: string }) {
  const loaded = useMemo(() => load(id), [id]);
  const layout = useMemo(() => computeLayout(loaded.run, VIEW), [loaded]);
  const [tl, dispatch] = useReducer(timelineReducer, loaded.run.steps.length, createTimeline);
  const [reduced, setReduced] = useState(false);
  const state = loaded.run.states[tl.k] ?? loaded.run.states[0];
  const scene = useMemo(() => (state ? buildScene(state, layout, VIEW) : null), [state, layout]);
  const step = tl.k > 0 ? loaded.run.steps[tl.k - 1] : undefined;
  const nextStep = loaded.run.steps[tl.k];
  if (!state || !scene) return null;

  const panelNames = Object.keys(state.panels);
  return (
    <MotionModeProvider scrubbing={tl.scrubbing} reduced={reduced}>
      <HoverProvider>
        <main style={{ minHeight: '100dvh', padding: '16px', color: 'var(--ink)', fontFamily: 'var(--font-ui)' }}>
          <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
            <h1 className="font-display" style={{ fontSize: 22, margin: 0 }}>
              Engine spike
            </h1>
            <nav aria-label="fixtures" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 14 }}>
              {[BS, ...fixtureIds].map((f) => (
                <Link key={f} href={f === BS ? '/spike' : `/spike/${f}`} data-testid={`fixture-${f}`} style={{ color: f === id ? 'var(--ink)' : 'var(--pen)', textDecoration: f === id ? 'none' : 'underline', fontWeight: f === id ? 600 : 400 }}>
                  {f}
                </Link>
              ))}
            </nav>
          </header>

          <p style={{ margin: '0 0 8px', color: 'var(--ink-2)', fontSize: 14 }}>{loaded.title}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }} className="spike-grid">
            <section aria-label="stage" style={{ border: '1px solid var(--rule)', borderRadius: 6, background: 'var(--bg)', overflowX: 'auto', overflowY: 'hidden' }}>
              <SceneView scene={scene} layout={layout} label={`${loaded.title}, step ${tl.k} of ${tl.length}`} />
            </section>

            <section aria-label="controls" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <button type="button" data-testid="prev" onClick={() => dispatch({ type: 'prev' })} disabled={tl.k === 0} style={btn}>
                ◀ Prev
              </button>
              <button type="button" data-testid="next" onClick={() => dispatch({ type: 'next' })} disabled={tl.k >= tl.length} style={btn}>
                Next ▶
              </button>
              <input
                type="range"
                data-testid="slider"
                aria-label="step"
                min={0}
                max={tl.length}
                value={tl.k}
                onChange={(e) => dispatch({ type: 'scrub', k: Number(e.currentTarget.value) })}
                onPointerUp={() => dispatch({ type: 'scrubEnd' })}
                onKeyUp={() => dispatch({ type: 'scrubEnd' })}
                onBlur={() => dispatch({ type: 'scrubEnd' })}
                style={{ flex: '1 1 160px', minWidth: 120, accentColor: 'var(--pen)' }}
              />
              <span data-testid="step" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, minWidth: '6ch' }}>
                {tl.k} / {tl.length}
              </span>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" data-testid="reduced" checked={reduced} onChange={(e) => setReduced(e.currentTarget.checked)} />
                instant
              </label>
              <span data-testid="prim-count" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
                {scene.prims.size} prims
              </span>
            </section>

            <Narration note={step ? step.note : `Start. ${nextStep ? 'Press Next to apply the first step.' : ''}`} phase={step?.phase} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <CodeView lines={loaded.pseudocode} current={step ? step.line : 0} />
              <VarsPanel scene={scene} />
              {panelNames.map((name) => {
                const kind = state.panels[name]?.kind;
                if (kind === 'stack') return <StackPanel key={name} scene={scene} panel={name} />;
                if (kind === 'queue') return <QueuePanel key={name} scene={scene} panel={name} />;
                if (kind === 'pq') return <PQPanel key={name} scene={scene} panel={name} />;
                return null;
              })}
              {Object.keys(state.frames).length > 0 && <CallStackPanel scene={scene} />}
              {state.graph && <DistTable scene={scene} />}
            </div>
          </div>
        </main>
      </HoverProvider>
    </MotionModeProvider>
  );
}

const btn: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: '0 14px',
  border: '1px solid var(--rule)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--ink)',
  font: 'inherit',
  cursor: 'pointer',
};
