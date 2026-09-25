/** A 'queue' panel: front of the queue first. */

import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { PanelList } from './PanelList';

export function QueuePanel({ scene, panel, title = 'Queue' }: { scene: Scene; panel: string; title?: string }) {
  const rows = primsOf(scene, 'row')
    .filter((r) => r.panel === panel)
    .sort((a, b) => a.order - b.order);
  return <PanelList title={title} rows={rows} ends={['front', 'back']} testId={`panel-${panel}`} />;
}
