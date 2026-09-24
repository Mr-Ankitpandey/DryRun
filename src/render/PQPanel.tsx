/** A 'pq' panel: rows in pop order (the reducer keeps them sorted by key,
 *  tie, id); the key is shown; a row targeted by a `skip` is struck through. */

import type { Scene } from '@/engine/scene';
import { primsOf } from '@/engine/scene';
import { PanelList } from './PanelList';

export function PQPanel({ scene, panel }: { scene: Scene; panel: string }) {
  const rows = primsOf(scene, 'row')
    .filter((r) => r.panel === panel)
    .sort((a, b) => a.order - b.order);
  return <PanelList title={panel} rows={rows} ends={['min', '']} showKey testId={`panel-${panel}`} />;
}
