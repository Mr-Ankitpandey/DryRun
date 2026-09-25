/** The data structures a module declares, next to the stage: variables, then
 *  every stack / queue / priority queue, the call stack when the algorithm
 *  recurses and the distance table for graphs. */

import type { Scene } from '@/engine/scene';
import type { State } from '@/engine/state';
import { CallStackPanel } from '@/render/CallStackPanel';
import { DistTable } from '@/render/DistTable';
import { PQPanel } from '@/render/PQPanel';
import { QueuePanel } from '@/render/QueuePanel';
import { StackPanel } from '@/render/StackPanel';
import { VarsPanel } from '@/render/VarsPanel';

export function StatePanels({ state, scene }: { state: State; scene: Scene }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {Object.entries(state.panels).map(([name, p]) => {
        if (p.kind === 'pq') return <PQPanel key={name} scene={scene} panel={name} />;
        if (p.kind === 'queue') return <QueuePanel key={name} scene={scene} panel={name} />;
        if (p.kind === 'stack') return <StackPanel key={name} scene={scene} panel={name} />;
        return null;
      })}
      {Object.keys(state.frames).length > 0 && <CallStackPanel scene={scene} />}
      {state.graph && <DistTable scene={scene} />}
      <VarsPanel scene={scene} />
    </div>
  );
}
