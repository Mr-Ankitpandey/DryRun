/** Trace screen `/t/:id` (WP-E, docs/DESIGN.md §1 wireframe and §5).
 *  The URL is the trace's identity: the module is resolved lazily from the
 *  registry, the input decoded by the module (invalid or absent → the first
 *  preset, with a quiet line saying so), the seed read or derived from the
 *  input, mode and level read with defaults (trace; the stored level). A trace
 *  never auto-plays when opened. */

import { useEffect, useState } from 'react';
import { useLocation, useParams, useSearch } from 'wouter';
import { findEntry } from '@/algorithms/registry';
import type { AlgorithmModule } from '@/algorithms/types';
import type { Level } from '@/trace/asks';
import { parseQuery, traceUrl } from '@/lib/url';
import { AppShell } from '@/ui/AppShell';
import { Button } from '@/ui/Button';
import { LinkButton } from '@/ui/LinkButton';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { useStore } from '@/ui/store';
import { TopBar } from '@/ui/TopBar';
import { DESKTOP_QUERY, useMediaQuery } from '@/ui/useMediaQuery';
import { SiteNav } from './SiteNav';
import { EditInput } from './trace/EditInput';
import { TracePlayer } from './trace/TracePlayer';
import { derivedSeed } from './trace/urls';

interface Loaded {
  id: string;
  module: AlgorithmModule<unknown>;
}

export default function Trace() {
  const { id = '' } = useParams<{ id: string }>();
  const entry = findEntry(id);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    let live = true;
    entry
      .load()
      .then((module) => {
        if (live) setLoaded({ id: entry.id, module });
      })
      .catch(() => {
        if (live) setFailed(entry.id);
      });
    return () => {
      live = false;
    };
  }, [entry]);

  if (!entry) return <Unknown id={id} />;
  const title = entry.title;
  if (failed === entry.id) {
    return (
      <AppShell topBar={<TopBar title={title} end={<SiteNav current="/algorithms" />} />}>
        <p className="text-base text-ink">This algorithm could not be loaded. Check the connection and reload the page.</p>
      </AppShell>
    );
  }
  if (!loaded || loaded.id !== entry.id) {
    return (
      <AppShell topBar={<TopBar title={title} end={<SiteNav current="/algorithms" />} />} width="full">
        <div className="min-h-[60dvh]" aria-busy="true" />
      </AppShell>
    );
  }
  return <TraceScreen key={entry.id} title={title} module={loaded.module} />;
}

function Unknown({ id }: { id: string }) {
  return (
    <AppShell topBar={<TopBar title="Trace" end={<SiteNav current="/algorithms" />} />}>
      <h1 className="font-display text-3xl">No algorithm called “{id}”</h1>
      <p className="mt-2 text-base text-ink-2">The link may be mistyped or from a newer version of DryRun.</p>
      <LinkButton href="/algorithms" variant="primary" className="mt-6">
        See all algorithms
      </LinkButton>
    </AppShell>
  );
}

function TraceScreen({ title, module }: { title: string; module: AlgorithmModule<unknown> }) {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { store } = useStore();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [editing, setEditing] = useState(false);

  const q = parseQuery(search);
  // Only a link that carries input parameters is decoded: several modules
  // accept an empty list, which must not win over the default example.
  const hasInput = Object.keys(module.encode(module.presets[0]?.input ?? {})).some((k) => k in q);
  const decoded = hasInput ? module.decode(q) : null;
  const preset = module.presets[0];
  const input = decoded ?? preset?.input ?? null;
  const mode: 'trace' | 'watch' = q.mode === 'watch' ? 'watch' : 'trace';
  const level: Level = q.level === 'full' || q.level === 'guided' ? q.level : store.settings.level;
  if (input === null) return null;
  const seed = q.seed && /^[\w-]{1,32}$/.test(q.seed) ? q.seed : derivedSeed(module.meta.id, module, input);
  const matching = module.presets.find((p) => JSON.stringify(p.input) === JSON.stringify(input));

  const set = (patch: Record<string, string>) => navigate(traceUrl(module.meta.id, { ...module.encode(input), seed: q.seed, mode, level, ...patch }));
  const go = (url: string) => {
    setEditing(false);
    navigate(url);
  };

  const notice = decoded === null && hasInput ? 'This link’s input could not be read, so the default example is shown.' : null;
  const about = matching ? `Example: ${matching.title.charAt(0).toLowerCase()}${matching.title.slice(1)}.` : null;

  const edit = (
    <Sheet open={editing} title="Edit input" showTitle onClose={() => setEditing(false)}>
      <EditInput module={module} input={input} mode={mode} level={level} onNavigate={go} onClose={() => setEditing(false)} />
    </Sheet>
  );

  return (
    <AppShell
      width="full"
      topBar={
        <TopBar
          title={title}
          end={
            <>
              <div className="hidden items-center gap-2 lg:flex">
                <Segmented label="Level" size="sm" value={level} onChange={(v) => set({ level: v })} options={[{ value: 'guided', label: 'Guided' }, { value: 'full', label: 'Full' }]} />
                <Segmented label="Mode" size="sm" value={mode} onChange={(v) => set({ mode: v })} options={[{ value: 'trace', label: 'Trace' }, { value: 'watch', label: 'Watch' }]} />
              </div>
              <Button size="sm" onClick={() => setEditing((e) => !e)} aria-expanded={editing} data-testid="edit-input-button">
                Edit input
              </Button>
              <div className="sm:hidden xl:block">
                <SiteNav current="/algorithms" />
              </div>
            </>
          }
        />
      }
    >
      {desktop && editing && <div className="px-4 pt-4">{edit}</div>}
      {(notice || about) && (
        <p className="m-0 max-w-none px-4 pt-3 text-sm text-ink-2" data-testid="input-notice">
          {notice ?? about} {notice || !matching ? null : <span className="hidden sm:inline">Edit input to trace your own.</span>}
        </p>
      )}
      <TracePlayer module={module} input={input} seed={seed} mode={mode} level={level} variant="full" persist />
      {!desktop && edit}
    </AppShell>
  );
}
