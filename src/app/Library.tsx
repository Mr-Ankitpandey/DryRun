/** Library `/algorithms` (WP-F, docs/DESIGN.md §5): every registered
 *  algorithm in one table with the learner's own accuracy and review status,
 *  filtered by family with a Segmented control. */

import { useMemo, useState } from 'react';
import { registry } from '@/algorithms/registry';
import type { Family } from '@/algorithms/types';
import { AppShell } from '@/ui/AppShell';
import { Segmented } from '@/ui/Segmented';
import type { SegmentedOption } from '@/ui/Segmented';
import { useStore } from '@/ui/store';
import { TopBar } from '@/ui/TopBar';
import { AlgorithmTable } from './library/AlgorithmTable';
import { familiesIn, libraryRows } from './library/rows';
import { SiteNav } from './SiteNav';

type Filter = 'all' | Family;

/** Short labels for the filter keys (the table uses the long ones). */
const FILTER_LABELS: Record<Family, string> = { search: 'Search', sort: 'Sorting', tree: 'Trees', graph: 'Graphs', dp: 'DP' };

export default function Library() {
  const { store } = useStore();
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => libraryRows(registry, store.sessions, store.review, now), [store.sessions, store.review, now]);
  const options = useMemo<SegmentedOption<Filter>[]>(
    () => [{ value: 'all', label: 'All' }, ...familiesIn(registry).map((f) => ({ value: f, label: FILTER_LABELS[f] }))],
    [],
  );
  const shown = filter === 'all' ? rows : rows.filter((r) => r.family === filter);
  const traced = rows.some((r) => r.asked > 0);

  return (
    <AppShell topBar={<TopBar title="Algorithms" end={<SiteNav />} />}>
      <div className="max-w-5xl">
        <h1 className="font-display text-3xl sm:text-4xl">Algorithms</h1>
        <p className="mt-2 text-base text-ink-2">
          {traced
            ? 'Pick one to trace. Accuracy counts every question you have answered on this device.'
            : 'Pick one to trace. Your accuracy and review dates fill in as you answer questions.'}
        </p>

        <div className="mt-6 overflow-x-auto pb-1">
          <Segmented label="Family" options={options} value={filter} onChange={setFilter} />
        </div>

        <AlgorithmTable className="mt-4" rows={shown} caption={filter === 'all' ? 'All algorithms' : `${FILTER_LABELS[filter]} algorithms`} />
      </div>
    </AppShell>
  );
}
