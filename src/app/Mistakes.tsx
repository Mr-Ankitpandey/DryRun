/** Mistake bank `/mistakes` (docs/DESIGN.md §5): every wrong prediction,
 *  grouped by the kind of misunderstanding, each with its rule and a link back
 *  to the exact trace. */

import { useMemo, useState } from 'react';
import { mistakeBank } from '@/trace/mistakes';
import { AppShell } from '@/ui/AppShell';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';
import { useStore } from '@/ui/store';
import { SiteNav } from './SiteNav';
import { LinkButton } from './learn/LinkButton';
import { MistakeKindRow } from './learn/MistakeKindRow';
import { RecoveredNotice } from './learn/RecoveredNotice';
import { plural } from './learn/format';
import { lede, screenTitle } from './learn/styles';

export default function Mistakes() {
  const { store } = useStore();
  const [now] = useState(() => Date.now());
  const bank = useMemo(() => mistakeBank(store.mistakes), [store.mistakes]);

  return (
    <AppShell topBar={<TopBar title="Mistakes" end={<SiteNav />} />}>
      <RecoveredNotice />
      <h1 className={screenTitle}>Mistake bank</h1>
      {bank.total === 0 ? (
        <EmptyState
          className="mt-2"
          title="No mistakes recorded yet"
          action={
            <LinkButton href="/algorithms" variant="primary">
              Choose an algorithm to trace
            </LinkButton>
          }
        >
          When a prediction is wrong, it lands here with the rule you missed, grouped by kind: off-by-one, comparison
          direction, stale entry and so on. Each one links back to the exact input so you can trace it again.
        </EmptyState>
      ) : (
        <>
          <p className={lede}>
            {plural(bank.total, 'mistake')} in {plural(bank.byKind.length, 'kind')}, most frequent first. Open a kind to
            see where it happened and re-trace that exact input.
          </p>
          <ul aria-label="Mistakes by kind" className="mt-6 max-w-3xl divide-y divide-rule border-y border-rule bg-surface">
            {bank.byKind.map((g, i) => (
              <MistakeKindRow key={g.kind} group={g} now={now} level={store.settings.level} defaultOpen={i === 0} />
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
