/** A 'stack' panel: top of the stack first. */

import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { PanelList } from './PanelList';

export function StackPanel({ scene, panel, title = 'Stack' }: { scene: Scene; panel: string; title?: string }) {
  const rows = primsOf(scene, 'row')
    .filter((r) => r.panel === panel)
    .sort((a, b) => b.order - a.order);
  return <PanelList title={title} rows={rows} ends={['top', 'bottom']} testId={`panel-${panel}`} />;
}
