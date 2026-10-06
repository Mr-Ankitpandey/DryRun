/** The data structures a module declares, next to the stage: variables, then
 *  every stack / queue / priority queue, the call stack when the algorithm
 *  recurses and the distance table for graphs (discovery / finish times for
 *  DFS, whose node labels are "d/f"). */

import type { Scene } from '@/engine/scene';
import type { State } from '@/engine/state';
import { CallStackPanel } from '@/render/CallStackPanel';
import { DistTable } from '@/render/DistTable';
import { PQPanel } from '@/render/PQPanel';
import { QueuePanel } from '@/render/QueuePanel';
import { StackPanel } from '@/render/StackPanel';
import { VarsPanel } from '@/render/VarsPanel';

/** Node-table wording per algorithm; distances by default. */
const NODE_TABLE: Record<string, { title: string; column: string }> = {
  dfs: { title: 'Times', column: 'd / f' },
};

export function StatePanels({ state, scene, algorithm }: { state: State; scene: Scene; algorithm?: string }) {
  const table = (algorithm !== undefined ? NODE_TABLE[algorithm] : undefined) ?? {};
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {Object.entries(state.panels).map(([name, p]) => {
        if (p.kind === 'pq') return <PQPanel key={name} scene={scene} panel={name} />;
        if (p.kind === 'queue') return <QueuePanel key={name} scene={scene} panel={name} />;
        if (p.kind === 'stack') return <StackPanel key={name} scene={scene} panel={name} />;
        return null;
      })}
      {Object.keys(state.frames).length > 0 && <CallStackPanel scene={scene} />}
      {state.graph && <DistTable scene={scene} {...table} />}
      <VarsPanel scene={scene} />
    </div>
  );
}
