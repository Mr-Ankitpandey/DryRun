/** A 'queue' panel: front of the queue first (or an output list, first to last). */

import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { PanelList } from './PanelList';

export function QueuePanel({ scene, panel, title = 'Queue', ends = ['front', 'back'] }: { scene: Scene; panel: string; title?: string; ends?: [string, string] }) {
  const rows = primsOf(scene, 'row')
    .filter((r) => r.panel === panel)
    .sort((a, b) => a.order - b.order);
  return <PanelList title={title} rows={rows} ends={ends} testId={`panel-${panel}`} />;
}
